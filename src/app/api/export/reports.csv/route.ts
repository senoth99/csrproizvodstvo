import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { csvEscape } from "@/lib/csv";
import { UserRole } from "@/lib/enums";
import { prismaUserListNameSelect } from "@/lib/prismaSafeUserInclude";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await requireRoleApi([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    if (!auth.ok) return auth.response;
    let reports;
    try {
      reports = await prisma.shiftReport.findMany({
        include: { user: { select: prismaUserListNameSelect }, shift: { include: { zone: true } } }
      });
    } catch (e) {
      console.error("[api/export/reports.csv]", e);
      return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
    }
    const header = "Сотрудник,Зона,Смена,Начало работы,Конец работы,Часов,Статус,Отчет,Создано";
    const rows = reports.map((r) =>
      [
        csvEscape(r.user.name),
        csvEscape(r.shift.zone.name),
        csvEscape(`${r.shift.startTime}-${r.shift.endTime}`),
        csvEscape(r.workStartTime),
        csvEscape(r.workEndTime),
        csvEscape(r.workedMinutes != null ? (r.workedMinutes / 60).toFixed(1) : ""),
        csvEscape(r.status),
        csvEscape(r.text),
        csvEscape(r.createdAt.toISOString())
      ].join(",")
    );
    return new NextResponse([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=reports.csv"
      }
    });
  } catch (e) {
    console.error("[api/export/reports.csv] fatal", e);
    return NextResponse.json({ error: "export_failed" }, { status: 503 });
  }
}
