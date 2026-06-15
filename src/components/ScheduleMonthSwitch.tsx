"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/lib/scheduleTable";

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

  const go = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    const mm = String(next.month).padStart(2, "0");
    const params = new URLSearchParams({ view: "month", month: `${next.year}-${mm}` });
    if (weekMode === "next") params.set("week", "next");
    router.push(`/schedule?${params.toString()}`);
  };

  return (
    <div className="card flex items-center justify-between gap-2 px-3 py-2">
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
