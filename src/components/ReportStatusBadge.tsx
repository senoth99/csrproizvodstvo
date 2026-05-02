import { ShiftReportStatus } from "@/lib/enums";
import { cn } from "@/lib/utils";

export function reportStatusLabel(status: string): string {
  if (status === ShiftReportStatus.ACCEPTED) return "Принят";
  if (status === ShiftReportStatus.PENDING_REVIEW) return "На проверке";
  return status;
}

export function ReportStatusBadge({ status }: { status: string }) {
  const isAccepted = status === ShiftReportStatus.ACCEPTED;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-display",
        isAccepted
          ? "border-accent/50 bg-accent text-foreground"
          : "border-highlight/55 bg-highlight/18 text-foreground"
      )}
    >
      {reportStatusLabel(status)}
    </span>
  );
}
