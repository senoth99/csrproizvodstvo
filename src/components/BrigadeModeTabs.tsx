"use client";

import type { BrigadeShiftLabel } from "@/lib/brigades";
import { cn } from "@/lib/utils";

const ORDER: BrigadeShiftLabel[] = ["День", "Вечер", "Ночь"];

const timeHint: Record<BrigadeShiftLabel, string> = {
  День: "10:00–18:00",
  Вечер: "18:00–00:00",
  Ночь: "20:00–02:00"
};

export function BrigadeModeTabs({
  value,
  onChange
}: {
  value: BrigadeShiftLabel;
  onChange: (next: BrigadeShiftLabel) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Режим смены"
      className="grid w-full grid-cols-3 gap-1.5 sm:gap-2"
    >
      {ORDER.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={cn(
              "flex min-h-[2.75rem] touch-manipulation flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition-all duration-200 sm:min-h-12 sm:px-2",
              active
                ? "border-accent/55 bg-accent text-foreground shadow-sm"
                : "border-border bg-background text-muted hover:border-foreground/18 hover:bg-foreground/[0.04] hover:text-foreground"
            )}
          >
            <span className="text-[10px] font-bold uppercase leading-tight tracking-display sm:text-[11px]">{m}</span>
            <span
              className={cn(
                "mt-0.5 line-clamp-2 max-w-[11rem] text-[8px] font-medium leading-snug sm:text-[9px]",
                active ? "text-foreground/75" : "text-muted"
              )}
            >
              {timeHint[m]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
