import { AppNotificationType, ShiftStatus } from "@/lib/enums";
import { notifyUser } from "@/lib/notifyDispatch";
import { prisma } from "@/lib/prisma";
import { describeShiftBrief } from "@/lib/shiftBrief";
import { addAppDays, APP_TIME_ZONE, formatDateRu, getAppISODay, getWeekStart, startOfAppDay } from "@/lib/utils";
import { formatInTimeZone } from "date-fns-tz";

export type ShiftReminderRunResult = {
  skippedReason?: string;
  sent: number;
  skippedNoPush: number;
};

/** Напоминание в 21:00 (МСК): у кого завтра смена. */
export async function sendTomorrowShiftReminders(options?: { force?: boolean }): Promise<ShiftReminderRunResult> {
  const now = new Date();
  const moscowHour = Number(formatInTimeZone(now, APP_TIME_ZONE, "H"));

  if (!options?.force && moscowHour !== 21) {
    return { skippedReason: "not_21_moscow", sent: 0, skippedNoPush: 0 };
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

  const userIds = [...byUser.keys()];
  const [alreadySent, pushSubs] = await Promise.all([
    userIds.length === 0
      ? Promise.resolve([] as { userId: string }[])
      : prisma.appNotification.findMany({
          where: {
            userId: { in: userIds },
            type: AppNotificationType.SHIFT_REMINDER,
            createdAt: { gte: dayStart }
          },
          select: { userId: true }
        }),
    userIds.length === 0
      ? Promise.resolve([] as { userId: string }[])
      : prisma.pushSubscription.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true }
        })
  ]);
  const alreadySentUserIds = new Set(alreadySent.map((row) => row.userId));
  const usersWithPush = new Set(pushSubs.map((row) => row.userId));

  let sent = 0;
  let skippedNoPush = 0;

  for (const shift of byUser.values()) {
    if (alreadySentUserIds.has(shift.userId)) continue;

    if (!usersWithPush.has(shift.userId)) skippedNoPush += 1;

    const brief = describeShiftBrief(shift);
    const title = "Напоминание: завтра смена";
    const body = `${tomorrowLabel}\n${brief}`;

    await notifyUser({
      userId: shift.userId,
      type: AppNotificationType.SHIFT_REMINDER,
      title,
      body,
      payload: { shiftId: shift.id, reminderFor: tomorrow.toISOString() },
      pushUrl: "/schedule"
    });

    sent += 1;
  }

  return { sent, skippedNoPush };
}
