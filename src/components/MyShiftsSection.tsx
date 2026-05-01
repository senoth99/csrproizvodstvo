"use client";

import { useMemo, useState } from "react";
import { addDays, isSameDay, parseISO } from "date-fns";
import { CalendarDays, Clock3, History, X, Wrench } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ReportModal } from "@/components/ReportModal";
import { ShiftStatus } from "@/lib/enums";
import { formatDateRu, isoFromWeekDay, weekDays } from "@/lib/utils";

type ShiftItem = {
  id: string;
  dayOfWeek: number;
  weekStartDateIso: string;
  startTime: string;
  endTime: string;
  status: string;
  zoneName: string;
  hasReport: boolean;
};

export function MyShiftsSection({ weekShifts, allShifts }: { weekShifts: ShiftItem[]; allShifts: ShiftItem[] }) {
  const [showArchive, setShowArchive] = useState(false);
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const active = useMemo(
    () => weekShifts.find((s) => s.status === ShiftStatus.IN_PROGRESS),
    [weekShifts]
  );

  const renderShiftCard = (s: ShiftItem) => {
    const shiftDay = isoFromWeekDay(parseISO(s.weekStartDateIso), s.dayOfWeek);
    const isToday = isSameDay(shiftDay, now);
    const isTomorrow = isSameDay(shiftDay, tomorrow);
    const dayBadge = isToday ? "Сегодня" : isTomorrow ? "Завтра" : null;

    return (
      <div key={s.id} className="card space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-accent" />
            {weekDays[s.dayOfWeek - 1]?.name}, {formatDateRu(shiftDay, "dd.MM")}
          </div>
          {dayBadge ? (
            <span
              className={`inline-flex min-w-[72px] justify-center rounded-md border px-2 py-1 text-[10px] font-medium leading-none ${
                isToday
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                  : "border-sky-400/40 bg-sky-500/10 text-sky-300"
              }`}
            >
              {dayBadge}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Wrench size={15} className="text-muted" />
          {s.zoneName}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Clock3 size={15} />
          {s.startTime} - {s.endTime}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 pb-20">
      <h2 className="text-lg font-semibold">Мои смены</h2>
      {weekShifts.length === 0 ? <EmptyState text="Установите смены в графике" /> : null}
      {active && !active.hasReport ? <ReportModal shiftId={active.id} /> : null}
      {weekShifts.map((s) => renderShiftCard(s))}

      <button
        className="btn-secondary fixed bottom-20 left-1/2 z-40 inline-flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-center gap-2 shadow-lg"
        onClick={() => setShowArchive((v) => !v)}
      >
        <History size={15} />
        Архив смен
      </button>

      {showArchive ? (
        <div className="fixed inset-0 z-[160] bg-black/55">
          <div className="flex h-full w-full flex-col bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Архив смен</h3>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:text-foreground"
                onClick={() => setShowArchive(false)}
                aria-label="Закрыть архив"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1 pb-24">
              {allShifts.length === 0 ? (
                <div className="card text-sm text-muted">Смен пока нет.</div>
              ) : (
                allShifts.map((s) => renderShiftCard(s))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
