"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  addAppDays,
  formatDateRu,
  isSameAppDay,
  safeParseISO
} from "@/lib/utils";
import { formatScheduleWeekStartParam, type ScheduleWeekKind } from "@/lib/scheduleWeek";

const SWIPE_THRESHOLD = 60;
const VERTICAL_TOLERANCE = 48;

function weekRangeLabel(start: Date) {
  return `${formatDateRu(start, "dd.MM")} - ${formatDateRu(addAppDays(start, 6), "dd.MM")}`;
}

function weekKindLabel(kind: ScheduleWeekKind): string {
  if (kind === "current") return "Нынешняя";
  if (kind === "next") return "Следующая";
  return "Выбранная";
}

/**
 * Режим недели задаёт сервер через `mode`; здесь только навигация.
 * Явный `useSearchParams` не используем — без `<Suspense>` в Next 15 это даёт bailout CSR и может «выбить» страницу (белый экран до гидратации).
 */
export function WeekModeSwitch({
  mode,
  weekKind,
  weekStartIso,
  canBrowseWeeks = false,
  currentWeekStartIso,
  nextWeekStartIso,
  scheduleView = "brigades",
  monthYear,
  monthMonth
}: {
  mode: "current" | "next";
  weekKind?: ScheduleWeekKind;
  weekStartIso?: string;
  canBrowseWeeks?: boolean;
  currentWeekStartIso: string;
  nextWeekStartIso: string;
  scheduleView?: "brigades" | "table";
  monthYear: number;
  monthMonth: number;
}) {
  const router = useRouter();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const currentStart = safeParseISO(currentWeekStartIso);
  const nextStart = safeParseISO(nextWeekStartIso);
  const activeStart = weekStartIso ? safeParseISO(weekStartIso) : mode === "next" ? nextStart : currentStart;
  const resolvedKind: ScheduleWeekKind =
    weekKind ?? (isSameAppDay(activeStart, currentStart) ? "current" : isSameAppDay(activeStart, nextStart) ? "next" : "other");

  const buildParams = (targetStart: Date) => {
    const params = new URLSearchParams();
    if (scheduleView === "table") params.set("view", "table");
    if (canBrowseWeeks) {
      if (!isSameAppDay(targetStart, currentStart)) {
        params.set("weekStart", formatScheduleWeekStartParam(targetStart));
      }
    } else if (isSameAppDay(targetStart, nextStart)) {
      params.set("week", "next");
    }
    const mm = String(monthMonth).padStart(2, "0");
    params.set("month", `${monthYear}-${mm}`);
    return params;
  };

  const pushWeek = (targetStart: Date) => {
    const params = buildParams(targetStart);
    const q = params.toString();
    router.push(q ? `/schedule?${q}` : "/schedule");
  };

  const setMode = (target: "current" | "next") => {
    pushWeek(target === "next" ? nextStart : currentStart);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) {
      startX.current = null;
      startY.current = null;
      return;
    }
    startX.current = event.touches[0]?.clientX ?? null;
    startY.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (startX.current === null || startY.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? startX.current;
    const endY = event.changedTouches[0]?.clientY ?? startY.current;
    const deltaX = endX - startX.current;
    const deltaY = endY - startY.current;
    startX.current = null;
    startY.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaY) > VERTICAL_TOLERANCE) return;

    if (canBrowseWeeks) {
      if (deltaX < 0) pushWeek(addAppDays(activeStart, 7));
      else pushWeek(addAppDays(activeStart, -7));
      return;
    }

    if (deltaX < 0) setMode("next");
    else setMode("current");
  };

  if (canBrowseWeeks) {
    return (
      <div
        className="card"
        data-no-swipe="true"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-stretch gap-1 rounded-md border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={() => pushWeek(addAppDays(activeStart, -7))}
            className="inline-flex min-h-[3.25rem] min-w-11 touch-manipulation items-center justify-center rounded border border-transparent text-muted transition hover:text-foreground"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center px-2 text-center">
            <span className="text-[10px] font-bold uppercase tracking-display text-foreground">
              {weekKindLabel(resolvedKind)}
            </span>
            <span className="text-[10px] font-semibold capitalize leading-tight text-muted">
              {weekRangeLabel(activeStart)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => pushWeek(addAppDays(activeStart, 7))}
            className="inline-flex min-h-[3.25rem] min-w-11 touch-manipulation items-center justify-center rounded border border-transparent text-muted transition hover:text-foreground"
            aria-label="Следующая неделя"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
        {!isSameAppDay(activeStart, currentStart) ? (
          <button
            type="button"
            onClick={() => pushWeek(currentStart)}
            className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-display text-muted transition hover:text-foreground"
          >
            К текущей неделе
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="card"
      data-no-swipe="true"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="grid w-full grid-cols-2 rounded-md border border-border bg-background p-0.5">
        <button
          type="button"
          onClick={() => setMode("current")}
          className={`min-h-[3.25rem] touch-manipulation rounded border px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-display transition-colors duration-200 ease-out ${
            mode === "current" ? "border-accent/55 bg-accent text-foreground" : "border-transparent text-muted"
          }`}
        >
          <span className="block">Нынешняя</span>
          <span className="block text-[10px] font-semibold capitalize leading-tight opacity-90">
            {weekRangeLabel(currentStart)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("next")}
          className={`min-h-[3.25rem] touch-manipulation rounded border px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-display transition-colors duration-200 ease-out ${
            mode === "next" ? "border-accent/55 bg-accent text-foreground" : "border-transparent text-muted"
          }`}
        >
          <span className="block">Следующая</span>
          <span className="block text-[10px] font-semibold capitalize leading-tight opacity-90">
            {weekRangeLabel(nextStart)}
          </span>
        </button>
      </div>
    </div>
  );
}
