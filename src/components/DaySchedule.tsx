import { Shift, User, Zone } from "@prisma/client";
import { weekDays } from "@/lib/utils";
import { ZoneSection } from "./ZoneSection";

type ShiftWithMeta = Shift & { user: User; zone: Zone };

export function DaySchedule({ dayOfWeek, shifts }: { dayOfWeek: number; shifts: ShiftWithMeta[] }) {
  const grouped = Object.groupBy(shifts, (s) => s.zone.name);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{weekDays[dayOfWeek - 1].name}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(grouped).map(([zone, list]) => (
          <ZoneSection key={zone} title={zone} shifts={list ?? []} />
        ))}
      </div>
    </div>
  );
}
