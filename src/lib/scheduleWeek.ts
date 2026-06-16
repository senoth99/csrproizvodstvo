import { addAppDays, formatDateRu, getWeekStart, isSameAppDay, safeParseISO } from "@/lib/utils";

export type ScheduleWeekKind = "current" | "next" | "other";

export function resolveScheduleWeekStart(params: {
  week?: string;
  weekStart?: string;
  now?: Date;
}): { weekStartDate: Date; kind: ScheduleWeekKind } {
  const now = params.now ?? new Date();
  const currentWeekStart = getWeekStart(now);
  const nextWeekStart = addAppDays(currentWeekStart, 7);

  if (params.weekStart?.trim()) {
    const parsed = safeParseISO(params.weekStart.trim());
    const normalized = getWeekStart(parsed);
    let kind: ScheduleWeekKind = "other";
    if (isSameAppDay(normalized, currentWeekStart)) kind = "current";
    else if (isSameAppDay(normalized, nextWeekStart)) kind = "next";
    return { weekStartDate: normalized, kind };
  }

  if (params.week === "next") {
    return { weekStartDate: nextWeekStart, kind: "next" };
  }

  return { weekStartDate: currentWeekStart, kind: "current" };
}

export function formatScheduleWeekStartParam(weekStartDate: Date): string {
  return formatDateRu(weekStartDate, "yyyy-MM-dd");
}
