import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { prismaUserListNameSelect } from "@/lib/prismaSafeUserInclude";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await requireRoleApi([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    if (!auth.ok) return auth.response;
    let shifts;
    try {
      shifts = await prisma.shift.findMany({ include: { user: { select: prismaUserListNameSelect }, zone: true } });
    } catch (e) {
      console.error("[api/export/shifts.csv]", e);
      return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
    }
    const header = "Сотрудник,Зона,Дата недели,День,Начало,Конец,Статус";
    const rows = shifts.map((s) =>
      [s.user.name, s.zone.name, s.weekStartDate.toISOString().slice(0, 10), s.dayOfWeek, s.startTime, s.endTime, s.status].join(",")
    );
    return new NextResponse([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=shifts.csv"
      }
    });
  } catch (e) {
    console.error("[api/export/shifts.csv] fatal", e);
    return NextResponse.json({ error: "export_failed" }, { status: 503 });
  }
}
