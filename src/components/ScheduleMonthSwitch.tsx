"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/lib/scheduleTable";

const SWIPE_THRESHOLD = 60;
const VERTICAL_TOLERANCE = 48;

export function ScheduleMonthSwitch({
  year,
  month,
  label,
  weekMode = "current"
}: {
  year: number;
  month: number;
  label: string;
  weekMode?: "current" | "next";
}) {
  const router = useRouter();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const go = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    const mm = String(next.month).padStart(2, "0");
    const params = new URLSearchParams({ view: "month", month: `${next.year}-${mm}` });
    if (weekMode === "next") params.set("week", "next");
    router.push(`/schedule?${params.toString()}`);
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
    if (deltaX < 0) go(1);
    else go(-1);
  };

  return (
    <div
      className="card flex items-center justify-between gap-2 px-3 py-2"
      data-no-swipe="true"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:bg-foreground/[0.05]"
        aria-label="Предыдущий месяц"
        onClick={() => go(-1)}
      >
        <ChevronLeft size={18} />
      </button>
      <p className="text-center text-sm font-semibold capitalize">{label}</p>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:bg-foreground/[0.05]"
        aria-label="Следующий месяц"
        onClick={() => go(1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
