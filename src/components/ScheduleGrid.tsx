import { Shift, User, Zone } from "@prisma/client";
import { DaySchedule } from "./DaySchedule";
import { weekDays } from "@/lib/utils";

type ShiftWithMeta = Shift & { user: User; zone: Zone };

export function ScheduleGrid({ shifts }: { shifts: ShiftWithMeta[] }) {
  return (
    <div className="space-y-8">
      {weekDays.map((day) => (
        <DaySchedule key={day.index} dayOfWeek={day.index} shifts={shifts.filter((s) => s.dayOfWeek === day.index)} />
      ))}
    </div>
  );
}
