import { Shift, User, Zone } from "@prisma/client";
import { ShiftBlock } from "./ShiftBlock";

type ShiftWithMeta = Shift & { user: User; zone: Zone };

export function ZoneSection({ title, shifts }: { title: string; shifts: ShiftWithMeta[] }) {
  return (
    <section className="card space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <div className="space-y-2">
        {shifts.map((shift) => (
          <ShiftBlock key={shift.id} shift={shift} />
        ))}
      </div>
    </section>
  );
}
