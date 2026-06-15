import type { ScheduleTableMonthEmployee } from "@/lib/scheduleTable";
import {
  SCHEDULE_MONTH_SHIFT_CELL_CLASS,
  ScheduleTableCell,
  ScheduleTableEmployeeCell,
  ScheduleTableScroll
} from "@/components/ScheduleTableCell";

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
      <ScheduleTableScroll>
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Таблица общего графика на месяц: сотрудник и место работы по дням месяца
          </caption>
          <thead>
            <tr className="border-b border-border bg-foreground/[0.03]">
              <th
                scope="col"
                className="sticky left-0 z-30 w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem] border-r border-border/80 bg-card px-2 py-2 text-[10px] font-bold uppercase tracking-display shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]"
              >
                Сотрудник
              </th>
              {days.map((d) => (
                <th
                  key={d.dayOfMonth}
                  scope="col"
                  className={`${SCHEDULE_MONTH_SHIFT_CELL_CLASS} px-0.5 py-2 text-center text-[10px] font-bold uppercase tracking-display ${
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
                <ScheduleTableEmployeeCell lastName={row.lastName} firstName={row.firstName} />
                {days.map((d) => (
                  <td
                    key={d.dayOfMonth}
                    className={`${SCHEDULE_MONTH_SHIFT_CELL_CLASS} px-0.5 py-1.5 align-top ${
                      d.isWeekend ? "bg-foreground/[0.02]" : ""
                    }`}
                  >
                    <ScheduleTableCell cell={row.byDayOfMonth[d.dayOfMonth] ?? null} compact />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScheduleTableScroll>
    </div>
  );
}
