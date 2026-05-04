"use client";

import { CalendarDays, Clock3, Wrench } from "lucide-react";
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

export function MyShiftsSection({ weekShifts }: { weekShifts: ShiftItem[] }) {
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
    <div className="space-y-2 pb-4">
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
          <p className="max-w-[240px] text-[12px] leading-snug text-muted/80">
            Запланируйте их в разделе «График».
          </p>
        </div>
      ) : null}
      {weekShifts.map((s) => renderShiftCard(s))}
    </div>
  );
}
