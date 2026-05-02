import type { Prisma } from "@prisma/client";
import { addHours, isBefore } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { prismaUserSwapRequesterSelect, prismaUserSwapTargetSelect } from "@/lib/prismaSafeUserInclude";
import { AppNotificationType, ShiftStatus, ShiftSwapStatus, UserRole } from "@/lib/enums";
import { notifyUserAppAndTelegram } from "@/lib/notifyDispatch";
import { telegramSendMessageWithKeyboard } from "@/lib/telegramBotHelpers";
import { formatDateRu, isoFromWeekDay, weekDays } from "@/lib/utils";

function toDateTime(weekStartDate: Date, dayOfWeek: number, time: string) {
  const date = isoFromWeekDay(weekStartDate, dayOfWeek);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function endAt(start: Date, startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const end = new Date(start);
  end.setHours(eh, em, 0, 0);
  if (eh < sh || (eh === sh && em <= sm)) end.setDate(end.getDate() + 1);
  return end;
}

async function assertNoOverlapExcludeTx(
  tx: Pick<typeof prisma, "shift">,
  userId: string,
  start: Date,
  end: Date,
  excludeIds: string[]
) {
  const shifts = await tx.shift.findMany({
    where: {
      userId,
      status: { in: [ShiftStatus.PLANNED, ShiftStatus.IN_PROGRESS, ShiftStatus.COMPLETED] },
      ...(excludeIds.length ? { NOT: { id: { in: excludeIds } } } : {})
    }
  });
  for (const s of shifts) {
    const sStart = toDateTime(s.weekStartDate, s.dayOfWeek, s.startTime);
    const sEnd = endAt(sStart, s.startTime, s.endTime);
    if (start < sEnd && end > sStart) {
      throw new Error("После обмена у одного из сотрудников пересечение смен.");
    }
  }
}

async function assertNoDupDayTx(
  tx: Pick<typeof prisma, "shift">,
  userId: string,
  weekStartDate: Date,
  dayOfWeek: number,
  excludeShiftIds: string[]
) {
  const dupWhere: Prisma.ShiftWhereInput = {
    userId,
    weekStartDate,
    dayOfWeek,
    status: { not: ShiftStatus.CANCELLED }
  };
  if (excludeShiftIds.length > 0) dupWhere.NOT = { id: { in: excludeShiftIds } };
  const existing = await tx.shift.findFirst({
    where: dupWhere,
    select: { id: true }
  });
  if (existing) throw new Error("После обмена у сотрудника две записи на один день.");
}

function assertEmployeeSwapWindow(actorRole: string, shiftStart: Date) {
  if (actorRole !== UserRole.EMPLOYEE) return;
  if (isBefore(shiftStart, addHours(new Date(), 24))) {
    throw new Error("Смену нельзя изменить меньше чем за 24 часа до начала.");
  }
}

function describeShiftBrief(shift: {
  zone: { name: string };
  dayOfWeek: number;
  weekStartDate: Date;
  startTime: string;
  endTime: string;
}): string {
  try {
    const dow = weekDays.find((w) => w.index === shift.dayOfWeek)?.name ?? "";
    const d = isoFromWeekDay(shift.weekStartDate, shift.dayOfWeek);
    return `${shift.zone.name}, ${dow}, ${formatDateRu(d, "dd.MM.")} ${shift.startTime}–${shift.endTime}`;
  } catch (e) {
    console.warn("[describeShiftBrief]", e);
    return "Смена";
  }
}

/** Помечает входящее уведомление обмена прочитанным у второй стороны (получателя запроса). */
export async function markIncomingSwapNotificationRead(userId: string, swapRequestId: string) {
  try {
    await prisma.appNotification.updateMany({
      where: {
        userId,
        swapRequestId,
        type: AppNotificationType.SHIFT_SWAP_INCOMING,
        readAt: null
      },
      data: { readAt: new Date() }
    });
  } catch (e) {
    console.error("[markIncomingSwapNotificationRead]", e);
  }
}

async function swapShiftsExecuted(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  offerId: string,
  targetId: string,
  updatedById: string | null
): Promise<{ a: string; b: string }> {
  const offer = await tx.shift.findUniqueOrThrow({ where: { id: offerId }, include: { zone: true, report: true, timeLog: true } });
  const target = await tx.shift.findUniqueOrThrow({
    where: { id: targetId },
    include: { zone: true, report: true, timeLog: true }
  });

  if (offer.report || target.report)
    throw new Error("Обмен недоступен: к одной из смен уже прикреплён отчёт.");
  if (offer.timeLog?.startedAt || target.timeLog?.startedAt)
    throw new Error("Обмен недоступен: смена уже начата по учёту времени.");

  if (offer.status !== ShiftStatus.PLANNED || target.status !== ShiftStatus.PLANNED) {
    throw new Error("Можно обмениваться только запланированными сменами.");
  }

  if (offer.weekStartDate.getTime() !== target.weekStartDate.getTime())
    throw new Error("Обмен возможен только в пределах одной недели графика.");

  const exclude = [offer.id, target.id];
  const aUser = offer.userId;
  const bUser = target.userId;

  const targetStart = toDateTime(target.weekStartDate, target.dayOfWeek, target.startTime);
  const targetEnd = endAt(targetStart, target.startTime, target.endTime);

  await assertNoOverlapExcludeTx(tx, aUser, targetStart, targetEnd, exclude);

  const offerStart = toDateTime(offer.weekStartDate, offer.dayOfWeek, offer.startTime);
  const offerEnd = endAt(offerStart, offer.startTime, offer.endTime);

  await assertNoOverlapExcludeTx(tx, bUser, offerStart, offerEnd, exclude);

  await assertNoDupDayTx(tx, aUser, target.weekStartDate, target.dayOfWeek, exclude);
  await assertNoDupDayTx(tx, bUser, offer.weekStartDate, offer.dayOfWeek, exclude);

  await tx.shift.update({
    where: { id: offer.id },
    data: { userId: bUser, updatedById }
  });
  await tx.shift.update({
    where: { id: target.id },
    data: { userId: aUser, updatedById }
  });

  return { a: aUser, b: bUser };
}

export type SwapRespondOutcome = { ok: true } | { ok: false; message: string };

export async function respondToShiftSwapRequest(
  requestId: string,
  accept: boolean,
  actorUserId: string,
  opts?: { skipRevalidate?: boolean }
): Promise<SwapRespondOutcome> {
  try {
  const reqFull = await prisma.shiftSwapRequest.findUnique({
    where: { id: requestId },
    include: {
      requesterShift: { include: { zone: true } },
      targetShift: { include: { zone: true, user: { select: prismaUserSwapTargetSelect } } },
      requester: { select: prismaUserSwapRequesterSelect }
    }
  });

  if (!reqFull) return { ok: false, message: "Запрос не найден." };
  if (reqFull.status !== ShiftSwapStatus.PENDING) return { ok: false, message: "Запрос уже обработан." };

  if (reqFull.targetShift.userId !== actorUserId) return { ok: false, message: "Этот запрос не для вас." };

  if (!accept) {
    await markIncomingSwapNotificationRead(actorUserId, requestId);

    await prisma.shiftSwapRequest.update({
      where: { id: requestId },
      data: { status: ShiftSwapStatus.DECLINED }
    });
    await notifyUserAppAndTelegram({
      userId: reqFull.requesterUserId,
      type: AppNotificationType.SHIFT_SWAP_OUTCOME,
      title: "Запрос на обмен",
      body: `${reqFull.targetShift.user.name} отклонил(а) обмен сменами.`,
      swapRequestId: requestId,
      payload: { swapRequestId: requestId, outcome: "declined" }
    });
    if (!opts?.skipRevalidate) {
      revalidatePath("/schedule");
      revalidatePath("/");
    }
    return { ok: true };
  }

  const [responderProfile, requesterProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actorUserId },
      select: { role: true }
    }),
    prisma.user.findUnique({
      where: { id: reqFull.requesterUserId },
      select: { role: true }
    })
  ]);
  const offerStartCheck = toDateTime(
    reqFull.requesterShift.weekStartDate,
    reqFull.requesterShift.dayOfWeek,
    reqFull.requesterShift.startTime
  );
  const targetStartCheck = toDateTime(
    reqFull.targetShift.weekStartDate,
    reqFull.targetShift.dayOfWeek,
    reqFull.targetShift.startTime
  );
  try {
    assertEmployeeSwapWindow(responderProfile?.role ?? UserRole.EMPLOYEE, targetStartCheck);
    assertEmployeeSwapWindow(requesterProfile?.role ?? UserRole.EMPLOYEE, offerStartCheck);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Нельзя обменять смену."
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await swapShiftsExecuted(tx, reqFull.requesterShiftId, reqFull.targetShiftId, actorUserId);
      await tx.shiftSwapRequest.update({
        where: { id: requestId },
        data: { status: ShiftSwapStatus.ACCEPTED }
      });
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Не удалось выполнить обмен."
    };
  }

  await markIncomingSwapNotificationRead(actorUserId, requestId);
  await notifyUserAppAndTelegram({
    userId: reqFull.requesterUserId,
    type: AppNotificationType.SHIFT_SWAP_OUTCOME,
    title: "Запрос на обмен",
    body: `${reqFull.targetShift.user.name} принял(а) обмен сменами.`,
    swapRequestId: requestId,
    payload: { swapRequestId: requestId, outcome: "accepted" }
  });

  await notifyUserAppAndTelegram({
    userId: actorUserId,
    type: AppNotificationType.SHIFT_SWAP_YOU_ACCEPTED,
    title: "Обмен выполнен",
    body: `Вы подтвердили обмен с ${reqFull.requester.name}. Слоты в графике обновлены.`,
    telegramText: `✅ Вы подтвердили обмен сменами с ${reqFull.requester.name}. График обновлён — откройте приложение.`,
    payload: { swapRequestId: requestId, outcome: "you_accepted" }
  });

  if (!opts?.skipRevalidate) {
    revalidatePath("/schedule");
    revalidatePath("/me");
    revalidatePath("/");
  }

  return { ok: true };
  } catch (e) {
    console.error("[respondToShiftSwapRequest]", e);
    return {
      ok: false,
      message:
        "Сервис временно недоступен (часто: база данных). На сервере выполните npx prisma migrate deploy и проверьте переменную DATABASE_URL."
    };
  }
}

export async function notifyTelegramIncomingSwap(opts: {
  responderTelegramId: string | null;
  requestId: string;
  requesterName: string;
  offerLabel: string;
  targetLabel: string;
}) {
  const chatIdNum = opts.responderTelegramId ? Number(opts.responderTelegramId) : NaN;
  if (!Number.isFinite(chatIdNum)) return;

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const appLine =
    appUrl.trim().length > 0
      ? `\nОткройте приложение: ${appUrl.replace(/\/$/, "")}/schedule`
      : "\nОткройте приложение с графиком, чтобы подтвердить.";

  const text =
    `🔄 Запрос на обмен сменами\n\n` +
    `От ${opts.requesterName}:\n` +
    `— отдаёт: ${opts.offerLabel}\n` +
    `— просит: ${opts.targetLabel}` +
    appLine;

  await telegramSendMessageWithKeyboard(chatIdNum, text, [
    [{ text: "✅ Принять", callback_data: `swap_acc:${opts.requestId}` }],
    [{ text: "Отклонить", callback_data: `swap_dec:${opts.requestId}` }]
  ]);
}

export { describeShiftBrief };
