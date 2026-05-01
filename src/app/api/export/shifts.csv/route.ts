import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  const shifts = await prisma.shift.findMany({ include: { user: true, zone: true } });
  const header = "Сотрудник,Зона,Дата недели,День,Начало,Конец,Статус";
  const rows = shifts.map((s) => [s.user.name, s.zone.name, s.weekStartDate.toISOString().slice(0, 10), s.dayOfWeek, s.startTime, s.endTime, s.status].join(","));
  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=shifts.csv"
    }
  });
}
