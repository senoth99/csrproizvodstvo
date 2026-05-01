import { ShiftStatus, type ShiftStatus as ShiftStatusValue } from "@/lib/enums";

const statusMap: Record<ShiftStatusValue, string> = {
  PLANNED: "Запланирована",
  IN_PROGRESS: "Идет",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена"
};

export function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = (Object.values(ShiftStatus).includes(status as ShiftStatusValue)
    ? status
    : ShiftStatus.PLANNED) as ShiftStatusValue;
  return <span className="rounded-full bg-surface px-2 py-1 text-xs">{statusMap[normalizedStatus]}</span>;
}
