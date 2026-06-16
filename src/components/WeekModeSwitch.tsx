"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { addAppDays, formatDateRu, safeParseISO } from "@/lib/utils";

const SWIPE_THRESHOLD = 60;
const VERTICAL_TOLERANCE = 48;

/**
 * Режим недели задаёт сервер через `mode`; здесь только навигация.
 * Явный `useSearchParams` не используем — без `<Suspense>` в Next 15 это даёт bailout CSR и может «выбить» страницу (белый экран до гидратации).
 */
export function WeekModeSwitch({
  mode,
  currentWeekStartIso,
  nextWeekStartIso,
  scheduleView = "brigades",
  monthYear,
  monthMonth
}: {
  mode: "current" | "next";
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
  const range = (start: Date) => `${formatDateRu(start, "dd.MM")} - ${formatDateRu(addAppDays(start, 6), "dd.MM")}`;

  const setMode = (target: "current" | "next") => {
    const params = new URLSearchParams();
    if (scheduleView === "table") params.set("view", "table");
    if (target === "next") params.set("week", "next");
    const mm = String(monthMonth).padStart(2, "0");
    params.set("month", `${monthYear}-${mm}`);
    const q = params.toString();
    router.push(q ? `/schedule?${q}` : "/schedule");
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
    if (deltaX < 0) setMode("next");
    else setMode("current");
  };

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
          <span className="block text-[10px] font-semibold capitalize leading-tight opacity-90">{range(currentStart)}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("next")}
          className={`min-h-[3.25rem] touch-manipulation rounded border px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-display transition-colors duration-200 ease-out ${
            mode === "next" ? "border-accent/55 bg-accent text-foreground" : "border-transparent text-muted"
          }`}
        >
          <span className="block">Следующая</span>
          <span className="block text-[10px] font-semibold capitalize leading-tight opacity-90">{range(nextStart)}</span>
        </button>
      </div>
    </div>
  );
}
