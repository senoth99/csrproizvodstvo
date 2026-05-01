import { Shift, User, Zone } from "@prisma/client";
import { StatusBadge } from "./StatusBadge";

type ShiftWithMeta = Shift & { user: User; zone: Zone };

export function ShiftBlock({ shift }: { shift: ShiftWithMeta }) {
  return (
    <div className="rounded-lg border border-border p-2 text-sm" style={{ borderLeftColor: shift.user.color, borderLeftWidth: 4 }}>
      <div className="font-semibold">{shift.user.name}</div>
      <div className="text-xs text-muted">{shift.zone.name}</div>
      <div className="text-xs">{shift.startTime} - {shift.endTime}</div>
      <StatusBadge status={shift.status} />
    </div>
  );
}
