import type { ScheduleTableMonthEmployee } from "@/lib/scheduleTable";
import { ScheduleTableCell } from "@/components/ScheduleTableCell";

export function ScheduleMonthTable({
  employees,
  days
}: {
  employees: ScheduleTableMonthEmployee[];
  days: { dayOfMonth: number; weekdayShort: string; isWeekend: boolean }[];
}) {
  if (employees.length === 0) {
    return (
      <div className="card py-10 text-center text-sm text-muted">В этом месяце смен пока нет.</div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border/80 px-3 py-3">
        <h2 className="text-sm font-bold uppercase tracking-display">Общий график на месяц</h2>
        <p className="mt-1 text-xs text-muted">Фамилия, имя и место работы по дням месяца.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Таблица общего графика на месяц: фамилия, имя и место работы по дням месяца
          </caption>
          <thead>
            <tr className="border-b border-border bg-foreground/[0.03]">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[5.5rem] border-r border-border/80 bg-card px-3 py-2 text-[10px] font-bold uppercase tracking-display"
              >
                Фамилия
              </th>
              <th
                scope="col"
                className="sticky left-[5.5rem] z-10 min-w-[5rem] border-r border-border/80 bg-card px-3 py-2 text-[10px] font-bold uppercase tracking-display"
              >
                Имя
              </th>
              {days.map((d) => (
                <th
                  key={d.dayOfMonth}
                  scope="col"
                  className={`min-w-[3.25rem] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-display ${
                    d.isWeekend ? "text-muted/70" : "text-muted"
                  }`}
                >
                  <span className="block tabular-nums">{d.dayOfMonth}</span>
                  <span className="block font-normal">{d.weekdayShort}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((row) => (
              <tr key={row.userId} className="border-b border-border/60 last:border-0">
                <td className="sticky left-0 z-10 border-r border-border/80 bg-card px-3 py-2 font-medium">
                  {row.lastName}
                </td>
                <td className="sticky left-[5.5rem] z-10 border-r border-border/80 bg-card px-3 py-2">
                  {row.firstName}
                </td>
                {days.map((d) => (
                  <td
                    key={d.dayOfMonth}
                    className={`px-1 py-1.5 align-top ${d.isWeekend ? "bg-foreground/[0.02]" : ""}`}
                  >
                    <ScheduleTableCell cell={row.byDayOfMonth[d.dayOfMonth] ?? null} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
