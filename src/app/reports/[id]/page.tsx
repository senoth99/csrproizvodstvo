import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { ReportReviewActions } from "@/components/ReportReviewActions";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getReportById } from "@/app/actions";
import { catchDb } from "@/lib/dbBoundary";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { ShiftReportStatus, UserRole } from "@/lib/enums";
import { formatDateRu, formatMoneyRu, isoFromWeekDay, weekDays } from "@/lib/utils";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const reportResult = await catchDb(`reports/${id}`, () => getReportById(id));
  if (!reportResult.ok) return <ServiceUnavailable scope={`reports/${id}`} />;
  const report = reportResult.data;
  if (!report) notFound();

  try {
    const viewer = await getCurrentUser();
    const isAdmin = viewer?.role === UserRole.ADMIN || viewer?.role === UserRole.SUPER_ADMIN;

    const dayLabel = weekDays.find((w) => w.index === report.shift.dayOfWeek)?.name ?? "";
    const shiftDate = isoFromWeekDay(report.shift.weekStartDate, report.shift.dayOfWeek);
    const slot = `${report.shift.zone.name} · ${dayLabel}, ${formatDateRu(shiftDate)} · ${report.shift.startTime}–${report.shift.endTime}`;

    const showEmployeeAccrual =
      !isAdmin &&
      report.status === ShiftReportStatus.ACCEPTED &&
      report.accrualAmountCents != null;

    return (
      <div className="space-y-4">
        <Link href="/reports" className="link-tech inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Все отчеты
        </Link>

        <div className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">Отчет по смене</h1>
              <p className="text-sm text-muted">{slot}</p>
              {isAdmin ? <p className="text-sm font-medium">{report.user.name}</p> : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
                <ReportStatusBadge status={report.status} />
                <p className="text-xs text-muted">
                  Отправлено {formatDateRu(report.createdAt, "dd.MM.yyyy HH:mm")}
                </p>
              </div>
            </div>
          </div>

          {!isAdmin && report.status === ShiftReportStatus.PENDING_REVIEW ? (
            <p className="rounded-sm border border-highlight/45 bg-highlight/12 px-3 py-2.5 text-sm leading-snug text-foreground/90">
              Отчёт на проверке. После проверки появится начисление и статус «Принят».
            </p>
          ) : null}

          {showEmployeeAccrual ? (
            <div className="rounded-lg border border-accent/45 bg-accent/15 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-display text-foreground">За смену начислено</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatMoneyRu(report.accrualAmountCents! / 100)}
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border-b border-border bg-transparent pb-3 pt-1">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.text}</p>
          </div>

          <ReportReviewActions
            reportId={report.id}
            status={report.status}
            accrualAmountCents={report.accrualAmountCents ?? null}
            acceptedByName={report.acceptedBy?.name?.trim() ? report.acceptedBy.name.trim() : null}
            isAdmin={Boolean(isAdmin)}
          />
        </div>
      </div>
    );
  } catch (e) {
    console.error("[reports/[id] render]", e);
    return <ServiceUnavailable scope={`reports/${id}`} />;
  }
}
