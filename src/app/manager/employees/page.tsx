import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ManagerEmployeesClient, type ManagerEmployeeListItem } from "@/components/ManagerEmployeesClient";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireAuth } from "@/lib/auth";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/enums";
import { ensureManagerDemoEmployeesIfEmpty } from "@/lib/managerDemoEmployees";

export default async function ManagerEmployeesPage() {
  const user = await requireAuth();
  if (!canOpenManagerPanel(user)) redirect("/schedule");

  await ensureManagerDemoEmployeesIfEmpty();

  const loaded = await catchDb("manager/employees", () =>
    prisma.user.findMany({
      where: { role: UserRole.EMPLOYEE },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        telegramUsername: true,
        color: true
      }
    })
  );
  if (!loaded.ok) return <ServiceUnavailable scope="manager/employees" />;

  const employees: ManagerEmployeeListItem[] = loaded.data.map((u) => ({
    id: u.id,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    telegramUsername: u.telegramUsername,
    color: u.color
  }));

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Link
          href="/manager"
          className="group inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-xl border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" aria-hidden />
          Панель
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Сотрудники</h1>

      <ManagerEmployeesClient employees={employees} />
    </div>
  );
}
