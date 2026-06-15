import type { ReactNode } from "react";
import type { ScheduleTableRowShift } from "@/lib/scheduleTable";

/** Фиксированная ширина ячейки смены — без сжатия и наложения текста при горизонтальном скролле. */
export const SCHEDULE_SHIFT_CELL_CLASS = "w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem]";
export const SCHEDULE_MONTH_SHIFT_CELL_CLASS = "w-[4.25rem] min-w-[4.25rem] max-w-[4.25rem]";

export function ScheduleTableEmployeeCell({
  lastName,
  firstName
}: {
  lastName: string;
  firstName: string;
}) {
  return (
    <td className="sticky left-0 z-20 w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem] border-r border-border/80 bg-card px-2 py-2 align-top shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]">
      <p className="text-xs font-semibold leading-snug break-words">{lastName}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted break-words">{firstName}</p>
    </td>
  );
}

export function ScheduleTableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <p className="border-b border-border/50 px-3 py-1.5 text-[10px] text-muted md:hidden">
        Листайте таблицу вправо →
      </p>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        {children}
      </div>
    </div>
  );
}

export function ScheduleTableCell({
  cell,
  compact = false
}: {
  cell: ScheduleTableRowShift | null;
  compact?: boolean;
}) {
  const sizeClass = compact ? SCHEDULE_MONTH_SHIFT_CELL_CLASS : SCHEDULE_SHIFT_CELL_CLASS;

  if (!cell) {
    return (
      <span className={`inline-block text-center text-muted/40 ${sizeClass}`}>—</span>
    );
  }

  return (
    <div className={`${sizeClass} text-[10px] leading-snug`}>
      <p className="font-semibold text-foreground break-words hyphens-auto">{cell.zoneName}</p>
      <p className="mt-0.5 tabular-nums text-muted whitespace-nowrap">{cell.startTime}–{cell.endTime}</p>
    </div>
  );
}
