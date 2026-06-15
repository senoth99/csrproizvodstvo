import { AppNotificationType, ShiftStatus } from "@/lib/enums";
import { notifyUserAppAndTelegram } from "@/lib/notifyDispatch";
import { prisma } from "@/lib/prisma";
import { describeShiftBrief } from "@/lib/shiftBrief";
import { resolveUserTelegramChatId } from "@/lib/telegramChatId";
import { addAppDays, APP_TIME_ZONE, formatDateRu, getAppISODay, getWeekStart, startOfAppDay } from "@/lib/utils";
import { formatInTimeZone } from "date-fns-tz";

export type ShiftReminderRunResult = {
  skippedReason?: string;
  sent: number;
  skippedNoTelegram: number;
};

/** Напоминание в 21:00 (МСК): у кого завтра смена. */
export async function sendTomorrowShiftReminders(options?: { force?: boolean }): Promise<ShiftReminderRunResult> {
  const now = new Date();
  const moscowHour = Number(formatInTimeZone(now, APP_TIME_ZONE, "H"));

  if (!options?.force && moscowHour !== 21) {
    return { skippedReason: "not_21_moscow", sent: 0, skippedNoTelegram: 0 };
  }

  const tomorrow = addAppDays(now, 1);
  const weekStart = getWeekStart(tomorrow);
  const dayOfWeek = getAppISODay(tomorrow);
  const tomorrowLabel = formatDateRu(tomorrow, "dd.MM.yyyy (EEEE)");
  const dayStart = startOfAppDay(now);

  const shifts = await prisma.shift.findMany({
    where: {
      weekStartDate: weekStart,
      dayOfWeek,
      status: { not: ShiftStatus.CANCELLED }
    },
    include: {
      user: { select: { id: true, name: true, isActive: true } },
      zone: true
    },
    orderBy: [{ startTime: "asc" }]
  });

  const byUser = new Map<string, (typeof shifts)[number]>();
  for (const shift of shifts) {
    if (!shift.user.isActive) continue;
    if (!byUser.has(shift.userId)) byUser.set(shift.userId, shift);
  }

  let sent = 0;
  let skippedNoTelegram = 0;

  for (const shift of byUser.values()) {
    const already = await prisma.appNotification.findFirst({
      where: {
        userId: shift.userId,
        type: AppNotificationType.SHIFT_REMINDER,
        createdAt: { gte: dayStart }
      },
      select: { id: true }
    });
    if (already) continue;

    const brief = describeShiftBrief(shift);
    const title = "Напоминание: завтра смена";
    const body = `${tomorrowLabel}\n${brief}`;
    const telegramText = `🔔 Напоминание: завтра у вас смена\n${tomorrowLabel}\n${brief}`;

    const chatId = await resolveUserTelegramChatId(shift.userId);
    if (chatId == null) skippedNoTelegram += 1;

    await notifyUserAppAndTelegram({
      userId: shift.userId,
      type: AppNotificationType.SHIFT_REMINDER,
      title,
      body,
      telegramText,
      payload: { shiftId: shift.id, reminderFor: tomorrow.toISOString() }
    });

    sent += 1;
  }

  return { sent, skippedNoTelegram };
}
