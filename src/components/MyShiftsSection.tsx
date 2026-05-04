"use client";

import { useState } from "react";
import { CalendarDays, Clock3, History, X, Wrench } from "lucide-react";
import { CompleteShiftReportDialog } from "@/components/CompleteShiftReportDialog";
import { ShiftReportStatus, ShiftStatus } from "@/lib/enums";
import {
  addAppDays,
  formatDateRu,
  isSameAppDay,
  isoFromWeekDay,
  safeParseISO,
  startOfAppDay,
  weekDays
} from "@/lib/utils";

type ShiftItem = {
  id: string;
  dayOfWeek: number;
  weekStartDateIso: string;
  startTime: string;
  endTime: string;
  status: string;
  zoneName: string;
  hasReport: boolean;
  reportStatus: string | null;
};

export function MyShiftsSection({
  weekShifts,
  archiveShifts,
  scheduledInWeekRangeCount
}: {
  weekShifts: ShiftItem[];
  /** Только смены, по которым уже отправлен отчёт (на проверке или принят). */
  archiveShifts: ShiftItem[];
  /** Смен в выбранном диапазоне до фильтра «в архив после отчёта» — для текста пустого списка */
  scheduledInWeekRangeCount: number;
}) {
  const [showArchive, setShowArchive] = useState(false);
  const now = new Date();
  const tomorrowStart = addAppDays(startOfAppDay(now), 1);

  const renderShiftCard = (s: ShiftItem) => {
    const shiftDay = isoFromWeekDay(safeParseISO(s.weekStartDateIso), s.dayOfWeek);
    const isToday = isSameAppDay(shiftDay, now);
    const isTomorrow = isSameAppDay(shiftDay, tomorrowStart);
    const dayBadge = isToday ? "Сегодня" : isTomorrow ? "Завтра" : null;

    const reportPending =
      s.hasReport && s.reportStatus === ShiftReportStatus.PENDING_REVIEW;
    const reportAccepted =
      s.hasReport &&
      (s.reportStatus === ShiftReportStatus.ACCEPTED ||
        (s.reportStatus == null)); /* до миграции статуса */
    const shiftHeadline = `${s.zoneName} · ${weekDays[s.dayOfWeek - 1]?.name ?? ""}, ${formatDateRu(
      shiftDay,
      "dd.MM"
    )} · ${s.startTime}–${s.endTime}`;

    const showCompleteFab =
      isToday &&
      s.status !== ShiftStatus.CANCELLED &&
      !reportPending &&
      !reportAccepted;

    return (
      <div
        key={s.id}
        className={`card space-y-2${showCompleteFab ? " relative pb-12 pr-12" : ""}`}
      >
        <div className="flex items-center justify-between gap-2 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-muted" aria-hidden />
            {weekDays[s.dayOfWeek - 1]?.name}, {formatDateRu(shiftDay, "dd.MM")}
          </div>
          {dayBadge ? (
            <span
              className={`inline-flex min-w-[72px] justify-center rounded-sm border px-2 py-1 text-[9px] font-bold uppercase tracking-display ${
                isToday ? "border-accent/50 bg-accent text-foreground" : "border-muted/40 bg-transparent text-muted"
              }`}
            >
              {dayBadge}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Wrench size={16} aria-hidden />
          <span className="text-foreground/90">{s.zoneName}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Clock3 size={16} aria-hidden />
          {s.startTime} - {s.endTime}
        </div>

        {isToday && s.status !== ShiftStatus.CANCELLED ? (
          reportPending ? (
            <p className="rounded-sm border border-highlight/45 bg-highlight/12 px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-display text-foreground">
              Отчёт на проверке
            </p>
          ) : reportAccepted ? (
            <p className="rounded-sm border border-accent/45 bg-accent/15 px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-display text-foreground">
              Смена принята
            </p>
          ) : (
            <CompleteShiftReportDialog shiftId={s.id} headline={shiftHeadline} />
          )
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-2 pb-20">
      <h2 className="text-base font-bold uppercase tracking-display">Мои смены</h2>
      {weekShifts.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg bg-background p-4 py-10 text-center"
          aria-live="polite"
        >
          <div className="flex w-full max-w-[200px] items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="select-none text-[17px] font-light leading-none tracking-widest text-muted">—</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
          </div>
          {scheduledInWeekRangeCount === 0 ? (
            <p className="max-w-[240px] text-[12px] leading-snug text-muted/80">
              Запланируйте их в разделе «График».
            </p>
          ) : null}
        </div>
      ) : null}
      {weekShifts.map((s) => renderShiftCard(s))}

      <button
        type="button"
        className={
          "btn-secondary fixed bottom-20 inset-x-3 z-[180] mx-auto inline-flex min-h-12 w-auto max-w-md touch-manipulation items-center justify-center gap-2 border-border bg-card shadow-lg pointer-events-auto transition-[box-shadow,colors] duration-200 active:!opacity-100 " +
          (showArchive ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-background" : "")
        }
        onClick={() => setShowArchive((v) => !v)}
        aria-expanded={showArchive}
        aria-controls="shift-archive-popup"
      >
        <History size={18} aria-hidden />
        Архив смен
      </button>

      {showArchive ? (
        <div
          id="shift-archive-popup"
          className="fixed inset-0 z-[170] flex items-center justify-center bg-background/85 p-3 backdrop-blur-[2px]"
          onClick={() => setShowArchive(false)}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold uppercase tracking-display">Архив смен</h3>
              <button
                type="button"
                className="inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg border border-border bg-background text-muted transition hover:bg-foreground/[0.06] hover:text-foreground"
                onClick={() => setShowArchive(false)}
                aria-label="Закрыть архив"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto px-3 py-3 md:px-4 md:py-4">
              {archiveShifts.length === 0 ? (
                <div className="card text-sm text-muted">
                  Здесь появятся смены после того, как вы отправите по ним отчёт.
                </div>
              ) : (
                archiveShifts.map((s) => renderShiftCard(s))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
