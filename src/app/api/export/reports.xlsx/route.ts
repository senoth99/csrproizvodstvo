import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ShiftReportStatus, UserRole } from "@/lib/enums";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { prismaUserListNameSelect } from "@/lib/prismaSafeUserInclude";
import { prisma } from "@/lib/prisma";
import { formatDateRu, formatMoneyRu, isoFromWeekDay, weekDays } from "@/lib/utils";
import { formatWorkedHoursDecimal } from "@/lib/workedHours";

export const runtime = "nodejs";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F8F5F" }
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const ALT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF4F7F5" }
};

function statusLabel(status: string) {
  return status === ShiftReportStatus.ACCEPTED ? "Принят" : "На проверке";
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } }
    };
  });
  row.height = 22;
}

function styleDataRow(row: ExcelJS.Row, alt: boolean) {
  row.eachCell((cell) => {
    if (alt) cell.fill = ALT_FILL;
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE8E8E8" } },
      left: { style: "thin", color: { argb: "FFE8E8E8" } },
      bottom: { style: "thin", color: { argb: "FFE8E8E8" } },
      right: { style: "thin", color: { argb: "FFE8E8E8" } }
    };
  });
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const canExport =
      user &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.SUPER_ADMIN ||
        canOpenManagerPanel(user));
    if (!canExport) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let reports;
    try {
      reports = await prisma.shiftReport.findMany({
        include: {
          user: { select: prismaUserListNameSelect },
          shift: { include: { zone: true } },
          acceptedBy: { select: prismaUserListNameSelect }
        },
        orderBy: [{ createdAt: "desc" }]
      });
    } catch (e) {
      console.error("[api/export/reports.xlsx]", e);
      return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Production Scheduler";
    workbook.created = new Date();

    const listSheet = workbook.addWorksheet("Все отчёты", {
      views: [{ state: "frozen", ySplit: 1 }]
    });
    listSheet.columns = [
      { header: "Сотрудник", key: "employee", width: 22 },
      { header: "Дата смены", key: "shiftDate", width: 14 },
      { header: "День", key: "day", width: 14 },
      { header: "Зона", key: "zone", width: 18 },
      { header: "Слот", key: "slot", width: 12 },
      { header: "Начало работы", key: "workStart", width: 14 },
      { header: "Конец работы", key: "workEnd", width: 14 },
      { header: "Часов", key: "hours", width: 10 },
      { header: "Статус", key: "status", width: 14 },
      { header: "Начислено", key: "accrual", width: 14 },
      { header: "За выход", key: "appearance", width: 12 },
      { header: "За работу", key: "workPay", width: 12 },
      { header: "Принял", key: "acceptedBy", width: 18 },
      { header: "Отправлено", key: "submitted", width: 18 },
      { header: "Отчёт", key: "text", width: 48 }
    ];
    styleHeaderRow(listSheet.getRow(1));

    reports.forEach((r, i) => {
      const shiftDate = isoFromWeekDay(r.shift.weekStartDate, r.shift.dayOfWeek);
      const dayLabel = weekDays.find((w) => w.index === r.shift.dayOfWeek)?.name ?? "";
      const row = listSheet.addRow({
        employee: r.user.name,
        shiftDate: formatDateRu(shiftDate),
        day: dayLabel,
        zone: r.shift.zone.name,
        slot: `${r.shift.startTime}–${r.shift.endTime}`,
        workStart: r.workStartTime ?? "—",
        workEnd: r.workEndTime ?? "—",
        hours: r.workedMinutes ? formatWorkedHoursDecimal(r.workedMinutes) : "—",
        status: statusLabel(r.status),
        accrual: r.accrualAmountCents != null ? formatMoneyRu(r.accrualAmountCents / 100) : "—",
        appearance: r.accrualAppearanceCents != null ? formatMoneyRu(r.accrualAppearanceCents / 100) : "—",
        workPay: r.accrualWorkCents != null ? formatMoneyRu(r.accrualWorkCents / 100) : "—",
        acceptedBy: r.acceptedBy?.name ?? "—",
        submitted: formatDateRu(r.createdAt, "dd.MM.yyyy HH:mm"),
        text: r.text
      });
      styleDataRow(row, i % 2 === 1);
    });

    const statsMap = new Map<
      string,
      { name: string; reports: number; minutes: number; accrualCents: number; accepted: number }
    >();
    for (const r of reports) {
      const cur = statsMap.get(r.userId) ?? {
        name: r.user.name,
        reports: 0,
        minutes: 0,
        accrualCents: 0,
        accepted: 0
      };
      cur.reports += 1;
      cur.minutes += r.workedMinutes ?? 0;
      cur.accrualCents += r.accrualAmountCents ?? 0;
      if (r.status === ShiftReportStatus.ACCEPTED) cur.accepted += 1;
      statsMap.set(r.userId, cur);
    }

    const statsSheet = workbook.addWorksheet("По сотрудникам", {
      views: [{ state: "frozen", ySplit: 1 }]
    });
    statsSheet.columns = [
      { header: "Сотрудник", key: "employee", width: 24 },
      { header: "Отчётов", key: "reports", width: 10 },
      { header: "Принято", key: "accepted", width: 10 },
      { header: "Часов всего", key: "hours", width: 14 },
      { header: "Среднее ч/отчёт", key: "avgHours", width: 16 },
      { header: "Начислено всего", key: "accrual", width: 18 }
    ];
    styleHeaderRow(statsSheet.getRow(1));

    const sortedStats = [...statsMap.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, "ru"));
    sortedStats.forEach((s, i) => {
      const avg = s.reports > 0 && s.minutes > 0 ? s.minutes / s.reports / 60 : 0;
      const row = statsSheet.addRow({
        employee: s.name,
        reports: s.reports,
        accepted: s.accepted,
        hours: formatWorkedHoursDecimal(s.minutes),
        avgHours: avg > 0 ? avg.toFixed(1).replace(".", ",") : "—",
        accrual: s.accrualCents > 0 ? formatMoneyRu(s.accrualCents / 100) : "—"
      });
      styleDataRow(row, i % 2 === 1);
      row.getCell("reports").alignment = { horizontal: "center" };
      row.getCell("accepted").alignment = { horizontal: "center" };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `otchety-${formatDateRu(new Date(), "yyyy-MM-dd")}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    console.error("[api/export/reports.xlsx] fatal", e);
    return NextResponse.json({ error: "export_failed" }, { status: 503 });
  }
}
