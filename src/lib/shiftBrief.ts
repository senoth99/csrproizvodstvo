import { formatDateRu, isoFromWeekDay, weekDays } from "@/lib/utils";

/** Краткая подпись смены для уведомлений и логов. */
export function describeShiftBrief(shift: {
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
