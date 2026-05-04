"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes, ChevronDown, Cpu, Flame, Scissors, Shirt, X } from "lucide-react";
import { managerAssignBrigadeShift, managerRemoveShift, toggleBrigadeAssignment } from "@/app/actions";
import { BrigadeModeTabs } from "@/components/BrigadeModeTabs";
import { UserAvatar } from "@/components/UserAvatar";
import type { BrigadeConfig, BrigadeShiftLabel } from "@/lib/brigades";
import { formatDateRu, isBeforeAppDay, isoFromWeekDay, safeParseISO, weekDays } from "@/lib/utils";

export type BrigadeAssignableEmployee = {
  id: string;
  name: string;
  color: string;
  telegramPhotoUrl: string | null;
};

type ShiftWithUser = {
  id: string;
  userId: string;
  dayOfWeek: number;
  zoneName: string;
  startTime: string;
  endTime: string;
  user: { id: string; name: string; color: string; telegramPhotoUrl?: string | null };
};

type PickCtx = {
  brigadeId: string;
  dayOfWeek: number;
  brigadeTitle: string;
  timeRange: string;
  dayLabel: string;
  dateShort: string;
  excludeUserIds: string[];
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
  weekMode,
  canManageSchedule = false,
  assignableEmployees = []
}: {
  brigades: BrigadeConfig[];
  shifts: ShiftWithUser[];
  currentUserId: string;
  weekStartDateIso: string;
  weekMode: "current" | "next";
  canManageSchedule?: boolean;
  assignableEmployees?: BrigadeAssignableEmployee[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [mode, setMode] = useState<BrigadeShiftLabel>("День");
  const [openBrigadeId, setOpenBrigadeId] = useState<string | null>(null);
  const [pickCtx, setPickCtx] = useState<PickCtx | null>(null);
  const [removeShift, setRemoveShift] = useState<ShiftWithUser | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  useEffect(() => {
    if (pickCtx) setSheetError(null);
  }, [pickCtx]);

  useEffect(() => {
    if (removeShift) setSheetError(null);
  }, [removeShift]);

  useEffect(() => {
    setOpenBrigadeId(null);
  }, [mode]);

  const weekStartDate = safeParseISO(weekStartDateIso);
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

  const modeCounts = useMemo(() => {
    const c: Record<BrigadeShiftLabel, number> = { День: 0, Вечер: 0, Ночь: 0 };
    for (const b of brigades) c[b.shiftLabel]++;
    return c;
  }, [brigades]);

  const pickerList = useMemo(() => {
    if (!pickCtx) return [];
    const ex = new Set(pickCtx.excludeUserIds);
    return assignableEmployees.filter((u) => !ex.has(u.id));
  }, [pickCtx, assignableEmployees]);

  const runAssign = (userId: string) => {
    if (!pickCtx || pending) return;
    start(async () => {
      try {
        setSheetError(null);
        await managerAssignBrigadeShift({
          brigadeId: pickCtx.brigadeId,
          dayOfWeek: pickCtx.dayOfWeek,
          weekStartDate: weekStartDateIso,
          userId
        });
        setPickCtx(null);
        router.refresh();
      } catch (e) {
        setSheetError(e instanceof Error ? e.message : "Не удалось назначить");
      }
    });
  };

  const runRemove = () => {
    if (!removeShift || pending) return;
    start(async () => {
      try {
        setSheetError(null);
        await managerRemoveShift(removeShift.id);
        setRemoveShift(null);
        router.refresh();
      } catch (e) {
        setSheetError(e instanceof Error ? e.message : "Не удалось снять смену");
      }
    });
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="sticky top-0 z-10 space-y-2.5 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur-md [-webkit-backdrop-filter:blur(10px)] sm:p-3.5">
        <h2 className="text-sm font-bold uppercase tracking-display">График работы</h2>
        <BrigadeModeTabs value={mode} onChange={setMode} counts={modeCounts} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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
                  weekMode === "current" ? "bg-foreground" : "bg-muted"
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
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-transparent text-muted">
                  <Icon size={16} aria-hidden />
                </span>
                <div>
                  <div className="text-sm font-semibold">{brigade.title}</div>
                  <div className="text-xs text-muted">
                    {brigade.startTime}-{brigade.endTime}
                  </div>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-muted transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            <div
              className={`grid transition-all duration-300 ease-out ${
                isOpen
                  ? "mt-3 grid-rows-[1fr] opacity-100"
                  : "pointer-events-none grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-2">
                  <div
                    className={`mb-1 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] ${
                      weekMode === "current"
                        ? "border-foreground/25 bg-foreground/[0.06]"
                        : "border-muted/35 bg-muted/[0.06]"
                    }`}
                  >
                    <span className={weekMode === "current" ? "text-foreground" : "text-muted"}>
                      {weekMode === "current" ? "Нынешняя" : "Следующая"} • {weekRangeLabel}
                    </span>
                  </div>
                  {weekDays.map((d) => {
                    const key = cellKey(brigade.zoneName, brigade.startTime, brigade.endTime, d.index);
                    const cellShifts = grouped.get(key) ?? [];
                    const mine = cellShifts.some((s) => s.userId === currentUserId);
                    const dayDate = isoFromWeekDay(weekStartDate, d.index);
                    const isPastDay = isBeforeAppDay(dayDate, new Date());

                    const openPicker = () => {
                      if (isPastDay || pending) return;
                      setPickCtx({
                        brigadeId: brigade.id,
                        dayOfWeek: d.index,
                        brigadeTitle: brigade.title,
                        timeRange: `${brigade.startTime}–${brigade.endTime}`,
                        dayLabel: d.name,
                        dateShort: formatDateRu(dayDate, "dd.MM"),
                        excludeUserIds: cellShifts.map((s) => s.userId)
                      });
                    };

                    const cellBody = (
                      <>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted">{d.name}</span>
                          <div className="flex items-center gap-2">
                            {isPastDay ? <span className="text-[10px] text-muted">Недоступно</span> : null}
                            <span className="text-muted">{formatDateRu(dayDate, "dd.MM")}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cellShifts.length === 0 ? (
                            <span className="text-xs text-muted">
                              {canManageSchedule ? "Нажмите, чтобы назначить сотрудника" : "Пусто — нажми, чтобы записаться"}
                            </span>
                          ) : (
                            cellShifts.map((s) =>
                              canManageSchedule ? (
                                <button
                                  key={s.id}
                                  type="button"
                                  data-shift-chip="1"
                                  disabled={pending || isPastDay}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPastDay || pending) return;
                                    setRemoveShift(s);
                                  }}
                                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-left text-[10px] transition-all duration-200 ease-out ${
                                    isPastDay
                                      ? "cursor-not-allowed border-border text-muted opacity-60"
                                      : s.userId === currentUserId
                                        ? "min-h-[2.25rem] border-foreground/20 bg-foreground/[0.07] text-foreground hover:border-muted/45 hover:bg-foreground/[0.1]"
                                        : "min-h-[2.25rem] border-border text-muted hover:border-muted/40 hover:bg-foreground/[0.05] hover:text-foreground"
                                  }`}
                                >
                                  <UserAvatar
                                    name={s.user.name}
                                    photoUrl={s.user.telegramPhotoUrl}
                                    color={s.user.color}
                                    size="sm"
                                  />
                                  <span className="truncate font-medium">{s.user.name}</span>
                                </button>
                              ) : (
                                <span
                                  key={s.id}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${
                                    s.userId === currentUserId
                                      ? "border-foreground/18 bg-foreground/[0.06] text-foreground"
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
                              )
                            )
                          )}
                        </div>
                      </>
                    );

                    if (canManageSchedule) {
                      return (
                        <div
                          key={`${brigade.id}-${d.index}`}
                          role="button"
                          tabIndex={isPastDay || pending ? -1 : 0}
                          onClick={openPicker}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openPicker();
                            }
                          }}
                          className={`w-full rounded-xl border p-2 text-left outline-none transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-foreground/25 ${
                            isPastDay
                              ? "cursor-not-allowed border-border bg-muted/[0.04] opacity-55"
                              : mine
                                ? "cursor-pointer border-border bg-transparent hover:bg-foreground/[0.05]"
                                : "cursor-pointer border-border bg-transparent hover:bg-foreground/[0.05]"
                          }`}
                        >
                          {cellBody}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={`${brigade.id}-${d.index}`}
                        type="button"
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
                            ? "cursor-not-allowed border-border bg-muted/[0.04] opacity-55"
                            : mine
                              ? "border-border bg-transparent"
                              : "border-border bg-transparent hover:bg-foreground/[0.05]"
                        }`}
                      >
                        {cellBody}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })}
      </div>
      {visibleBrigades.length === 0 ? (
        <div className="card text-sm text-muted">На этот режим бригад пока нет.</div>
      ) : null}

      {pickCtx ? (
        <div
          className="fixed inset-0 z-[120] flex flex-col justify-end bg-background/85 p-3 pb-[max(0.75rem,var(--safe-bottom))] pt-10 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-shift-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Закрыть"
            onClick={() => setPickCtx(null)}
          />
          <div className="relative z-[1] max-h-[min(78vh,560px)] w-full max-w-md overflow-hidden rounded-lg border border-border bg-background animate-in">
            <div className="flex items-start justify-between gap-2 border-b border-border/80 px-4 py-3">
              <div className="min-w-0">
                <h3 id="assign-shift-title" className="text-base font-bold tracking-tight">
                  Назначить смену
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  {pickCtx.brigadeTitle} · {pickCtx.timeRange}
                </p>
                <p className="mt-1 text-[11px] text-foreground/80">
                  {pickCtx.dayLabel}, {pickCtx.dateShort}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickCtx(null)}
                className="-mr-1 -mt-1 rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5 text-muted" aria-hidden />
              </button>
            </div>
            <div className="max-h-[min(52vh,420px)] overflow-y-auto px-2 py-2">
              {pickerList.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm leading-relaxed text-muted">
                  {assignableEmployees.length === 0 ? (
                    <>
                      Некого назначить: в системе нет активных пользователей. Проверьте пользователей в админке (
                      <span className="text-foreground/90">роль и флаг «активен»</span>).
                    </>
                  ) : (
                    <>
                      В этой ячейке уже учтены все пользователи из списка назначения. Чтобы поставить другого, сначала
                      нажмите на его чип и снимите смену.
                    </>
                  )}
                </p>
              ) : (
                <ul className="space-y-1">
                  {pickerList.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => runAssign(u.id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-border hover:bg-surface disabled:opacity-50"
                      >
                        <UserAvatar name={u.name} photoUrl={u.telegramPhotoUrl} color={u.color} size="md" />
                        <span className="truncate text-sm font-medium">{u.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {sheetError ? (
              <p className="border-t border-border bg-muted/[0.04] px-4 py-2 text-[12px] font-medium text-foreground/85">{sheetError}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {removeShift ? (
        <div
          className="fixed inset-0 z-[120] flex flex-col justify-end bg-background/85 p-3 pb-[max(0.75rem,var(--safe-bottom))] pt-10 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-shift-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Закрыть"
            onClick={() => setRemoveShift(null)}
          />
          <div className="relative z-[1] w-full max-w-sm overflow-hidden rounded-lg border border-border bg-background animate-in">
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/[0.06]">
                <UserAvatar
                  name={removeShift.user.name}
                  photoUrl={removeShift.user.telegramPhotoUrl}
                  color={removeShift.user.color}
                  size="lg"
                />
              </div>
              <h3 id="remove-shift-title" className="text-lg font-medium">
                Снять смену?
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                <span className="font-semibold text-foreground">{removeShift.user.name}</span> будет удалён из этой ячейки
                графика ({removeShift.zoneName}, {removeShift.startTime}–{removeShift.endTime}).
              </p>
            </div>
            <div className="flex gap-2 border-t border-border/80 px-4 py-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setRemoveShift(null)}
                className="btn-secondary flex-1 py-2.5 text-sm disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={runRemove}
                className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
              >
                {pending ? "…" : "Снять"}
              </button>
            </div>
            {sheetError ? (
              <p className="border-t border-border bg-muted/[0.04] px-4 py-2 text-center text-[12px] font-medium text-foreground/85">
                {sheetError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
