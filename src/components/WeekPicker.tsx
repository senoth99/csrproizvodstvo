"use client";

import { addWeeks, formatISO } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export function WeekPicker({ current }: { current: Date }) {
  const router = useRouter();
  const setWeek = (date: Date) => {
    router.push(`/schedule?week=${formatISO(date, { representation: "date" })}`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setWeek(new Date())}>
        <CalendarClock size={16} />
        Текущая неделя
      </button>
      <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setWeek(addWeeks(current, -1))}>
        <ChevronLeft size={16} />
        Предыдущая
      </button>
      <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setWeek(addWeeks(current, 1))}>
        Следующая
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
