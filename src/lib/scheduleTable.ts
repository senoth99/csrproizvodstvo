import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  APP_TIME_ZONE,
  addAppDays,
  formatDateRu,
  getWeekStart,
  isoFromWeekDay,
  weekDays
} from "@/lib/utils";
import { isShiftDateInAppMonth } from "@/lib/workedHours";

export type ScheduleTableRowShift = {
  zoneName: string;
  startTime: string;
  endTime: string;
};

export type ScheduleTableEmployee = {
  userId: string;
  lastName: string;
  firstName: string;
  byDay: Record<number, ScheduleTableRowShift | null>;
};

export type ScheduleTableMonthEmployee = {
  userId: string;
  lastName: string;
  firstName: string;
  byDayOfMonth: Record<number, ScheduleTableRowShift | null>;
};

export type ScheduleTableShiftInput = {
  userId: string;
  lastName: string;
  firstName: string;
  dayOfWeek: number;
  zoneName: string;
  startTime: string;
  endTime: string;
};

export type ScheduleTableMonthShiftInput = ScheduleTableShiftInput & {
  weekStartDate: Date;
};

export function splitEmployeeName(
  name: string,
  firstName: string | null | undefined,
  lastName: string | null | undefined
): { lastName: string; firstName: string } {
  const fn = firstName?.trim() ?? "";
  const ln = lastName?.trim() ?? "";
  if (ln || fn) return { lastName: ln || "—", firstName: fn || "—" };
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { lastName: parts[0] ?? "—", firstName: parts.slice(1).join(" ") || "—" };
  }
  return { lastName: name.trim() || "—", firstName: "—" };
}

function compareEmployees(a: { lastName: string; firstName: string }, b: { lastName: string; firstName: string }) {
  const ln = a.lastName.localeCompare(b.lastName, "ru");
  if (ln !== 0) return ln;
  return a.firstName.localeCompare(b.firstName, "ru");
}

export function buildWeekScheduleTable(shifts: ScheduleTableShiftInput[]): ScheduleTableEmployee[] {
  const byUser = new Map<string, ScheduleTableEmployee>();

  for (const s of shifts) {
    if (s.dayOfWeek < 1 || s.dayOfWeek > 7) continue;
    let row = byUser.get(s.userId);
    if (!row) {
      row = {
        userId: s.userId,
        lastName: s.lastName,
        firstName: s.firstName,
        byDay: Object.fromEntries(weekDays.map((d) => [d.index, null])) as Record<number, ScheduleTableRowShift | null>
      };
      byUser.set(s.userId, row);
    }
    row.byDay[s.dayOfWeek] = {
      zoneName: s.zoneName,
      startTime: s.startTime,
      endTime: s.endTime
    };
  }

  return [...byUser.values()].sort(compareEmployees);
}

export function buildMonthScheduleTable(
  shifts: ScheduleTableMonthShiftInput[],
  year: number,
  month: number,
  daysInMonth: number
): ScheduleTableMonthEmployee[] {
  const byUser = new Map<string, ScheduleTableMonthEmployee>();

  for (const s of shifts) {
    if (!isShiftDateInAppMonth(s.weekStartDate, s.dayOfWeek, year, month)) continue;
    const shiftDate = isoFromWeekDay(s.weekStartDate, s.dayOfWeek);
    const dom = toZonedTime(shiftDate, APP_TIME_ZONE).getDate();
    if (dom < 1 || dom > daysInMonth) continue;

    let row = byUser.get(s.userId);
    if (!row) {
      row = {
        userId: s.userId,
        lastName: s.lastName,
        firstName: s.firstName,
        byDayOfMonth: Object.fromEntries(
          Array.from({ length: daysInMonth }, (_, i) => [i + 1, null])
        ) as Record<number, ScheduleTableRowShift | null>
      };
      byUser.set(s.userId, row);
    }
    row.byDayOfMonth[dom] = {
      zoneName: s.zoneName,
      startTime: s.startTime,
      endTime: s.endTime
    };
  }

  return [...byUser.values()].sort(compareEmployees);
}

export function mapShiftToTableInput(shift: {
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weekStartDate: Date;
  user: { name: string; firstName: string | null; lastName: string | null };
  zone: { name: string };
}): ScheduleTableMonthShiftInput {
  const { lastName, firstName } = splitEmployeeName(shift.user.name, shift.user.firstName, shift.user.lastName);
  return {
    userId: shift.userId,
    lastName,
    firstName,
    dayOfWeek: shift.dayOfWeek,
    weekStartDate: shift.weekStartDate,
    zoneName: shift.zone.name,
    startTime: shift.startTime,
    endTime: shift.endTime
  };
}

export function getAppMonthMeta(year: number, month: number) {
  const refUtc = Date.UTC(year, month - 1, 15, 12, 0, 0);
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE }).format(
    new Date(refUtc)
  );

  const days: { dayOfMonth: number; weekdayShort: string; isWeekend: boolean }[] = [];
  for (let d = 1; d <= 31; d++) {
    const local = fromZonedTime(new Date(year, month - 1, d, 12, 0, 0), APP_TIME_ZONE);
    const z = toZonedTime(local, APP_TIME_ZONE);
    if (z.getFullYear() !== year || z.getMonth() + 1 !== month) break;
    const dow = z.getDay();
    days.push({
      dayOfMonth: d,
      weekdayShort: formatDateRu(local, "EEEEE"),
      isWeekend: dow === 0 || dow === 6
    });
  }

  if (days.length === 0) {
    return { label, days, weekStarts: [], daysInMonth: 0 };
  }

  const firstDay = fromZonedTime(new Date(year, month - 1, 1, 12, 0, 0), APP_TIME_ZONE);
  const lastDay = fromZonedTime(new Date(year, month - 1, days.length, 12, 0, 0), APP_TIME_ZONE);
  const weekStarts: Date[] = [];
  let ws = getWeekStart(firstDay);
  const limit = addAppDays(getWeekStart(lastDay), 7);
  while (ws.getTime() < limit.getTime()) {
    weekStarts.push(ws);
    ws = addAppDays(ws, 7);
  }

  return { label, days, weekStarts, daysInMonth: days.length };
}

export function parseMonthParam(raw: string | undefined): { year: number; month: number } | null {
  if (!raw?.trim()) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export function shiftMonth(year: number, month: number, delta: number) {
  let y = year;
  let m = month + delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}
