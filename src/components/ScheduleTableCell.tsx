import type { ScheduleTableRowShift } from "@/lib/scheduleTable";

export function ScheduleTableCell({ cell }: { cell: ScheduleTableRowShift | null }) {
  if (!cell) {
    return <span className="text-muted/40">—</span>;
  }
  return (
    <div className="min-w-[4.5rem] text-[10px] leading-tight">
      <p className="font-semibold text-foreground">{cell.zoneName}</p>
      <p className="tabular-nums text-muted">
        {cell.startTime}–{cell.endTime}
      </p>
    </div>
  );
}
