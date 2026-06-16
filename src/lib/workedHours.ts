import { toZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE, isoFromWeekDay } from "@/lib/utils";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHm(time: string): { hours: number; minutes: number } | null {
  const m = TIME_RE.exec(time.trim());
  if (!m) return null;
  return { hours: Number(m[1]), minutes: Number(m[2]) };
}

/** Минуты с полуночи для HH:mm. */
export function hmToMinutes(time: string): number | null {
  const p = parseHm(time);
  if (!p) return null;
  return p.hours * 60 + p.minutes;
}

/** Длительность в минутах; если конец < начала — смена через полночь. */
export function computeWorkedMinutes(workStartTime: string, workEndTime: string): number {
  const start = hmToMinutes(workStartTime);
  const end = hmToMinutes(workEndTime);
  if (start == null || end == null) throw new Error("Некорректное время работы.");
  if (start === end) return 1;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  if (diff > 24 * 60) throw new Error("Длительность смены не может превышать 24 часа.");
  if (diff < 1) throw new Error("Укажите время окончания позже времени начала.");
  return diff;
}

/** HH:mm в часовом поясе приложения. */
export function formatTimeHm(date: Date, timeZone = APP_TIME_ZONE): string {
  const z = toZonedTime(date, timeZone);
  return `${String(z.getHours()).padStart(2, "0")}:${String(z.getMinutes()).padStart(2, "0")}`;
}

export function formatWorkedMinutes(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || totalMinutes <= 0) return "—";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} ч`;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

export function formatWorkedHoursDecimal(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || totalMinutes <= 0) return "0";
  const hours = totalMinutes / 60;
  return hours % 1 === 0 ? String(hours) : hours.toFixed(1).replace(".", ",");
}

export function getCurrentAppMonth(): { year: number; month: number; label: string } {
  const z = toZonedTime(new Date(), APP_TIME_ZONE);
  const year = z.getFullYear();
  const month = z.getMonth() + 1;
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE }).format(
    new Date()
  );
  return { year, month, label };
}

export function isShiftDateInAppMonth(
  weekStartDate: Date,
  dayOfWeek: number,
  year: number,
  month: number
): boolean {
  const shiftDate = isoFromWeekDay(weekStartDate, dayOfWeek);
  const z = toZonedTime(shiftDate, APP_TIME_ZONE);
  return z.getFullYear() === year && z.getMonth() + 1 === month;
}

export type ReportWorkedRow = {
  userId: string;
  workedMinutes: number | null;
  shift: { weekStartDate: Date; dayOfWeek: number };
};

export function sumWorkedMinutesForMonth(
  reports: ReportWorkedRow[],
  year: number,
  month: number,
  userId?: string
): number {
  let total = 0;
  for (const r of reports) {
    if (userId && r.userId !== userId) continue;
    if (r.workedMinutes == null || r.workedMinutes <= 0) continue;
    if (!isShiftDateInAppMonth(r.shift.weekStartDate, r.shift.dayOfWeek, year, month)) continue;
    total += r.workedMinutes;
  }
  return total;
}

export function groupMonthlyWorkedByUser(
  reports: ReportWorkedRow[],
  year: number,
  month: number
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of reports) {
    if (r.workedMinutes == null || r.workedMinutes <= 0) continue;
    if (!isShiftDateInAppMonth(r.shift.weekStartDate, r.shift.dayOfWeek, year, month)) continue;
    map.set(r.userId, (map.get(r.userId) ?? 0) + r.workedMinutes);
  }
  return map;
}
