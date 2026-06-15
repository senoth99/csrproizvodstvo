import type { ScheduleTableEmployee } from "@/lib/scheduleTable";
import { formatDateRu, isoFromWeekDay, safeParseISO, weekDays } from "@/lib/utils";
import { ScheduleTableCell } from "@/components/ScheduleTableCell";

export function ScheduleWeekTable({
  employees,
  weekStartDateIso
}: {
  employees: ScheduleTableEmployee[];
  weekStartDateIso: string;
}) {
  const weekStart = safeParseISO(weekStartDateIso);

  if (employees.length === 0) {
    return (
      <div className="card py-10 text-center text-sm text-muted">На эту неделю смен пока нет.</div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border/80 px-3 py-3">
        <h2 className="text-sm font-bold uppercase tracking-display">Общий график на неделю</h2>
        <p className="mt-1 text-xs text-muted">Фамилия, имя и место работы — видят все сотрудники.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Таблица общего графика на неделю: фамилия, имя и место работы по дням недели
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
              {weekDays.map((d) => {
                const dayDate = isoFromWeekDay(weekStart, d.index);
                return (
                  <th
                    key={d.index}
                    scope="col"
                    className="min-w-[5rem] px-2 py-2 text-[10px] font-bold uppercase tracking-display text-muted"
                  >
                    <span className="block">{d.name.slice(0, 2)}</span>
                    <span className="block font-normal tabular-nums">{formatDateRu(dayDate, "dd.MM")}</span>
                  </th>
                );
              })}
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
                {weekDays.map((d) => (
                  <td key={d.index} className="px-2 py-2 align-top">
                    <ScheduleTableCell cell={row.byDay[d.index] ?? null} />
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
