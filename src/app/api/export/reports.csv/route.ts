import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  const reports = await prisma.shiftReport.findMany({ include: { user: true, shift: { include: { zone: true } } } });
  const header = "Сотрудник,Зона,Смена,Отчет,Создано";
  const rows = reports.map((r) => [r.user.name, r.shift.zone.name, `${r.shift.startTime}-${r.shift.endTime}`, `"${r.text.replaceAll("\"", "\"\"")}"`, r.createdAt.toISOString()].join(","));
  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=reports.csv"
    }
  });
}
