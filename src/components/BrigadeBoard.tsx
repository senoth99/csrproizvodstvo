"use client";

import { useMemo, useState, useTransition } from "react";
import { isBefore, parseISO, startOfDay } from "date-fns";
import { Boxes, ChevronDown, Cpu, Flame, Scissors, Shirt } from "lucide-react";
import { toggleBrigadeAssignment } from "@/app/actions";
import { UserAvatar } from "@/components/UserAvatar";
import type { BrigadeConfig } from "@/lib/brigades";
import { formatDateRu, isoFromWeekDay, weekDays } from "@/lib/utils";

type ShiftWithUser = {
  id: string;
  userId: string;
  dayOfWeek: number;
  zoneName: string;
  startTime: string;
  endTime: string;
  user: { id: string; name: string; color: string; telegramPhotoUrl?: string | null };
};

const iconMap = {
  heat: Flame,
  printer: Shirt,
  scissors: Scissors,
  cpu: Cpu,
  warehouse: Boxes
} as const;

const cellKey = (zoneName: string, startTime: string, endTime: string, dayOfWeek: number) =>
  `${zoneName}|${startTime}|${endTime}|${dayOfWeek}`;

export function BrigadeBoard({
  brigades,
  shifts,
  currentUserId,
  weekStartDateIso,
  weekMode
}: {
  brigades: BrigadeConfig[];
  shifts: ShiftWithUser[];
  currentUserId: string;
  weekStartDateIso: string;
  weekMode: "current" | "next";
}) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"День" | "Вечер">("День");
  const [openBrigadeId, setOpenBrigadeId] = useState<string | null>(null);
  const weekStartDate = parseISO(weekStartDateIso);
  const weekRangeLabel = `${formatDateRu(weekStartDate, "dd.MM")} - ${formatDateRu(
    isoFromWeekDay(weekStartDate, 7),
    "dd.MM"
  )}`;
  const grouped = new Map<string, ShiftWithUser[]>();
  for (const s of shifts) {
    const key = cellKey(s.zoneName, s.startTime, s.endTime, s.dayOfWeek);
    const list = grouped.get(key) ?? [];
    list.push(s);
    grouped.set(key, list);
  }
  const visibleBrigades = useMemo(() => brigades.filter((b) => b.shiftLabel === mode), [brigades, mode]);

  return (
    <div className="space-y-4 animate-in">
      <div className="rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight">График работы</h2>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          <button
            onClick={() => setMode("День")}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-all duration-300 ease-out ${
              mode === "День" ? "bg-accent text-black shadow-sm" : "text-muted"
            }`}
          >
            День
          </button>
          <button
            onClick={() => setMode("Вечер")}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-all duration-300 ease-out ${
              mode === "Вечер" ? "bg-accent text-black shadow-sm" : "text-muted"
            }`}
          >
            Вечер
          </button>
          </div>
        </div>
      </div>

      {visibleBrigades.map((brigade) => {
        const Icon = iconMap[brigade.icon];
        const isOpen = openBrigadeId === brigade.id;
        const hasMyShiftInBrigade = weekDays.some((d) => {
          const key = cellKey(brigade.zoneName, brigade.startTime, brigade.endTime, d.index);
          const cellShifts = grouped.get(key) ?? [];
          return cellShifts.some((s) => s.userId === currentUserId);
        });
        return (
          <section key={brigade.id} className="card relative transition-all duration-300 ease-out">
            {hasMyShiftInBrigade ? (
              <span
                className={`absolute left-3 top-3 h-[5px] w-[5px] rounded-full ${
                  weekMode === "current" ? "bg-emerald-400" : "bg-sky-400"
                }`}
                aria-label={weekMode === "current" ? "Есть смена на текущей неделе" : "Есть смена на следующей неделе"}
                title={weekMode === "current" ? "Есть смена на текущей неделе" : "Есть смена на следующей неделе"}
              />
            ) : null}
            <button
              type="button"
              onClick={() => setOpenBrigadeId((prev) => (prev === brigade.id ? null : brigade.id))}
              className="flex w-full items-center justify-between gap-3 pl-4 text-left transition-colors duration-300"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1f29] text-accent">
                  <Icon size={16} />
                </span>
                <div>
                  <div className="text-sm font-semibold">{brigade.title}</div>
                  <div className="text-xs text-muted">{brigade.startTime}-{brigade.endTime}</div>
                </div>
              </div>
              <ChevronDown size={16} className={`text-muted transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <div
              className={`grid transition-all duration-300 ease-out ${
                isOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-2">
                <div
                  className={`mb-1 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] ${
                    weekMode === "current"
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : "border-sky-400/40 bg-sky-500/10"
                  }`}
                >
                  <span className={weekMode === "current" ? "text-emerald-300" : "text-sky-300"}>
                    {weekMode === "current" ? "Нынешняя" : "Следующая"} • {weekRangeLabel}
                  </span>
                </div>
                {weekDays.map((d) => {
                  const key = cellKey(brigade.zoneName, brigade.startTime, brigade.endTime, d.index);
                  const cellShifts = grouped.get(key) ?? [];
                  const mine = cellShifts.some((s) => s.userId === currentUserId);
                  const dayDate = isoFromWeekDay(weekStartDate, d.index);
                  const isPastDay = isBefore(startOfDay(dayDate), startOfDay(new Date()));
                  return (
                    <button
                      key={`${brigade.id}-${d.index}`}
                      disabled={pending || isPastDay}
                      onClick={() =>
                        start(async () => {
                          await toggleBrigadeAssignment({
                            brigadeId: brigade.id,
                            dayOfWeek: d.index,
                            weekStartDate: weekStartDateIso
                          });
                        })
                      }
                      className={`w-full rounded-xl border p-2 text-left transition-all duration-200 ease-out ${
                        isPastDay
                          ? "cursor-not-allowed border-border bg-[#0d1016] opacity-55"
                          : mine
                            ? "border-border bg-surface"
                            : "border-border bg-surface hover:bg-[#1a1f29]"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted">{d.name}</span>
                        <div className="flex items-center gap-2">
                          {isPastDay ? <span className="text-[10px] text-muted">Недоступно</span> : null}
                          <span className="text-muted">{formatDateRu(dayDate, "dd.MM")}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cellShifts.length === 0 ? (
                          <span className="text-xs text-muted">Пусто — нажми, чтобы записаться</span>
                        ) : (
                          cellShifts.map((s) => (
                            <span
                              key={s.id}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${
                                s.userId === currentUserId
                                  ? "border-white/30 bg-white/10 text-foreground"
                                  : "border-border text-muted"
                              }`}
                            >
                              <UserAvatar
                                name={s.user.name}
                                photoUrl={s.user.telegramPhotoUrl}
                                color={s.user.color}
                                size="sm"
                              />
                              {s.user.name}
                            </span>
                          ))
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
          </section>
        );
      })}
      {visibleBrigades.length === 0 ? (
        <div className="card text-sm text-muted">На этот режим бригад пока нет.</div>
      ) : null}
    </div>
  );
}
