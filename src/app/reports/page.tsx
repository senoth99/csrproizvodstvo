import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { ReportsExcelDownload } from "@/components/ReportsExcelDownload";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { catchAuth, catchDb } from "@/lib/dbBoundary";
import { requireAuth } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { prismaUserListNameSelect } from "@/lib/prismaSafeUserInclude";
import { formatDateRu, isoFromWeekDay, weekDays } from "@/lib/utils";
import { formatPhoneDisplay } from "@/lib/formatPhone";
import { formatWorkedMinutes } from "@/lib/workedHours";

const MAX_REPORTS_IN_LIST = 50;

function userIsReportAdmin(actor: { role: string; isManager?: boolean | null }) {
  return actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN || Boolean(actor.isManager);
}

export default async function ReportsPage() {
  const authResult = await catchAuth(() => requireAuth());
  if (!authResult.ok) return <ServiceUnavailable scope="reports" />;
  const user = authResult.data;
  const isAdmin = userIsReportAdmin(user);
  const reportsResult = await catchDb("reports", () =>
    prisma.shiftReport.findMany({
      where: isAdmin ? undefined : { userId: user.id },
      include: {
        user: { select: prismaUserListNameSelect },
        shift: { include: { zone: true } },
        acceptedBy: { select: prismaUserListNameSelect }
      },
      orderBy: { createdAt: "desc" },
      take: MAX_REPORTS_IN_LIST
    })
  );
  if (!reportsResult.ok) return <ServiceUnavailable scope="reports" />;
  const reports = reportsResult.data;

  try {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-display sm:text-3xl">Отчеты</h1>
            {!isAdmin ? (
              <p className="text-sm text-muted">Только ваши отчёты по сменам.</p>
            ) : (
              <p className="text-sm text-muted">Все отчёты сотрудников и выгрузка в Excel.</p>
            )}
          </div>
          {isAdmin ? <ReportsExcelDownload /> : null}
        </div>

        {reports.length === 0 ? (
          <div className="card text-sm text-muted">Пока нет ни одного отчета.</div>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => {
              const dayLabel = weekDays.find((w) => w.index === r.shift.dayOfWeek)?.name ?? "";
              const shiftDate = isoFromWeekDay(r.shift.weekStartDate, r.shift.dayOfWeek);
              const meta = `${r.shift.zone.name} · ${dayLabel}, ${formatDateRu(shiftDate)} · ${r.shift.startTime}–${r.shift.endTime}`;

              return (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="card flex min-h-[52px] touch-manipulation items-stretch gap-3 transition hover:bg-foreground/[0.04]"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5 text-left">
                      {isAdmin ? (
                        <p className="text-sm font-medium text-foreground">
                          {r.user.name}
                          {r.user.phone ? (
                            <span className="ml-2 font-normal tabular-nums text-muted">
                              {formatPhoneDisplay(r.user.phone)}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <ReportStatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-muted">{meta}</p>
                      {r.workStartTime && r.workEndTime ? (
                        <p className="text-xs text-muted">
                          Работа: {r.workStartTime}–{r.workEndTime}
                          {r.workedMinutes ? ` · ${formatWorkedMinutes(r.workedMinutes)}` : null}
                        </p>
                      ) : null}
                      <p className="line-clamp-2 text-sm text-foreground">{r.text}</p>
                      <p className="text-xs text-muted">Отправлено {formatDateRu(r.createdAt, "dd.MM.yyyy HH:mm")}</p>
                    </div>
                    <ChevronRight className="my-auto h-5 w-5 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  } catch (e) {
    console.error("[reports/page render]", e);
    return <ServiceUnavailable scope="reports" />;
  }
}
