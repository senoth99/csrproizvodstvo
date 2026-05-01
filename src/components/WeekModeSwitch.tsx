"use client";

import { addDays, parseISO } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateRu } from "@/lib/utils";

export function WeekModeSwitch({
  mode,
  currentWeekStartIso,
  nextWeekStartIso
}: {
  mode: "current" | "next";
  currentWeekStartIso: string;
  nextWeekStartIso: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const currentStart = parseISO(currentWeekStartIso);
  const nextStart = parseISO(nextWeekStartIso);
  const range = (start: Date) => `${formatDateRu(start, "dd.MM")} - ${formatDateRu(addDays(start, 6), "dd.MM")}`;

  const setMode = (target: "current" | "next") => {
    const sp = new URLSearchParams(params.toString());
    if (target === "next") sp.set("week", "next");
    else sp.delete("week");
    const query = sp.toString();
    router.push(query ? `/schedule?${query}` : "/schedule");
  };

  return (
    <div className="card">
      <div className="grid w-full grid-cols-2 rounded-xl border border-border bg-surface p-0.5">
        <button
          onClick={() => setMode("current")}
          className={`rounded-lg border px-2 py-1 text-xs font-semibold transition-all duration-300 ease-out ${
            mode === "current"
              ? "border-accent bg-accent text-black shadow-sm"
              : "border-transparent text-muted"
          }`}
        >
          <span className="block">Нынешняя</span>
          <span className="block text-[10px] opacity-80">{range(currentStart)}</span>
        </button>
        <button
          onClick={() => setMode("next")}
          className={`rounded-lg border px-2 py-1 text-xs font-semibold transition-all duration-300 ease-out ${
            mode === "next"
              ? "border-accent bg-accent text-black shadow-sm"
              : "border-transparent text-muted"
          }`}
        >
          <span className="block">Следующая</span>
          <span className="block text-[10px] opacity-80">{range(nextStart)}</span>
        </button>
      </div>
    </div>
  );
}
