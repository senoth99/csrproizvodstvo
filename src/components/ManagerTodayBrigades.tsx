import { Boxes, Cpu, Flame, Scissors, Shirt } from "lucide-react";
import type { BrigadeConfig } from "@/lib/brigades";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

const iconMap = {
  heat: Flame,
  printer: Shirt,
  scissors: Scissors,
  cpu: Cpu,
  warehouse: Boxes
} as const;

export type ManagerTodayShift = {
  id: string;
  zoneName: string;
  startTime: string;
  endTime: string;
  user: { name: string; color: string; telegramPhotoUrl: string | null };
};

function cellKey(zoneName: string, startTime: string, endTime: string) {
  return `${zoneName}|${startTime}|${endTime}`;
}

export function ManagerTodayBrigades({
  brigades,
  shifts,
  weekdayLabel,
  dateLabel
}: {
  brigades: BrigadeConfig[];
  shifts: ManagerTodayShift[];
  weekdayLabel: string;
  dateLabel: string;
}) {
  const grouped = new Map<string, ManagerTodayShift[]>();
  for (const s of shifts) {
    const k = cellKey(s.zoneName, s.startTime, s.endTime);
    const list = grouped.get(k) ?? [];
    list.push(s);
    grouped.set(k, list);
  }

  return (
    <div className="space-y-3 animate-in">
      <div className="rounded-lg border border-border bg-card px-3 py-2.5">
        <h2 className="text-sm font-bold uppercase tracking-display">Бригада на сегодня</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          <span className="font-medium text-foreground/90">{weekdayLabel}</span>
          <span className="text-muted"> · </span>
          <span>{dateLabel}</span>
        </p>
      </div>

      <div className="space-y-2.5">
        {brigades.map((brigade) => {
          const Icon = iconMap[brigade.icon];
          const key = cellKey(brigade.zoneName, brigade.startTime, brigade.endTime);
          const cellShifts = grouped.get(key) ?? [];
          const hasStaff = cellShifts.length > 0;

          return (
            <section
              key={brigade.id}
              className="card overflow-hidden border-border/90 shadow-none transition-colors"
            >
              <div className="flex items-start gap-3 border-b border-border/60 bg-foreground/[0.02] px-3 py-3 sm:px-4">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted">
                  <Icon size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h3 className="text-sm font-bold tracking-tight text-foreground sm:text-base">{brigade.title}</h3>
                    <span className="rounded-md border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-display text-muted">
                      {brigade.shiftLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {brigade.zoneName} · {brigade.startTime}–{brigade.endTime}
                  </p>
                </div>
              </div>

              <div className="px-3 py-3 sm:px-4 sm:py-3.5">
                {hasStaff ? (
                  <ul className="flex flex-wrap gap-2">
                    {cellShifts.map((s) => (
                      <li
                        key={s.id}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.06] px-2.5 py-1.5 pr-3"
                      >
                        <UserAvatar
                          name={s.user.name}
                          photoUrl={s.user.telegramPhotoUrl}
                          color={s.user.color}
                          size="sm"
                        />
                        <span className="truncate text-xs font-semibold text-foreground/95">{s.user.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div
                    className={cn(
                      "flex min-h-[3rem] items-center justify-center rounded-xl border border-dashed px-3 py-2.5",
                      "border-highlight/35 bg-highlight/[0.06] text-center"
                    )}
                  >
                    <p className="text-xs font-semibold uppercase tracking-display text-highlight/95">
                      Нет сотрудника
                    </p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
