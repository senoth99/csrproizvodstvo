import { getAppISODay, getWeekStart } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { ShiftStatus } from "@/lib/enums";

/** Смена пользователя на сегодня (по календарю Москвы), если есть. */
export async function findUserShiftToday(userId: string) {
  const today = new Date();
  const weekStart = getWeekStart(today);
  const dayOfWeek = getAppISODay(today);

  return prisma.shift.findFirst({
    where: {
      userId,
      weekStartDate: weekStart,
      dayOfWeek,
      status: { not: ShiftStatus.CANCELLED }
    },
    include: { zone: true, timeLog: true }
  });
}

/** QR-чекин доступен только если на сегодня есть смена в статусе PLANNED. */
export function canStartShiftViaQrToday(
  shift: { status: string } | null | undefined
): shift is { status: typeof ShiftStatus.PLANNED } {
  return shift?.status === ShiftStatus.PLANNED;
}
