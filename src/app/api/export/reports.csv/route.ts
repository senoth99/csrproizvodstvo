import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
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
    const header = "Сотрудник,Зона,Смена,Статус,Отчет,Создано";
    const rows = reports.map((r) =>
      [
        r.user.name,
        r.shift.zone.name,
        `${r.shift.startTime}-${r.shift.endTime}`,
        r.status,
        `"${r.text.replaceAll("\"", "\"\"")}"`,
        r.createdAt.toISOString()
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
