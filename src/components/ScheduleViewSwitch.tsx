"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type ScheduleView = "brigades" | "table" | "month";

export function ScheduleViewSwitch({
  view,
  weekMode,
  monthYear,
  monthMonth
}: {
  view: ScheduleView;
  weekMode: "current" | "next";
  monthYear: number;
  monthMonth: number;
}) {
  const router = useRouter();

  const go = (next: ScheduleView) => {
    if (next === view) return;
    const params = new URLSearchParams();
    if (next !== "brigades") params.set("view", next);
    if (weekMode === "next") params.set("week", "next");
    const mm = String(monthMonth).padStart(2, "0");
    params.set("month", `${monthYear}-${mm}`);
    const q = params.toString();
    router.push(q ? `/schedule?${q}` : "/schedule");
  };

  const tabs: { id: ScheduleView; label: string }[] = [
    { id: "brigades", label: "Бригады" },
    { id: "table", label: "Неделя" },
    { id: "month", label: "Месяц" }
  ];

  return (
    <div className="card p-1">
      <div className="grid grid-cols-3 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => go(tab.id)}
            className={cn(
              "min-h-[2.75rem] touch-manipulation rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-display transition-colors",
              view === tab.id
                ? "border-accent/55 bg-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
