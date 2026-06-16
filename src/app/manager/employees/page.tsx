import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { ManagerEmployeesClient } from "@/components/ManagerEmployeesClient";
import { PendingApprovalsPanel } from "@/components/PendingApprovalsPanel";
import { requireAuth } from "@/lib/auth";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/enums";
import { ensureManagerDemoEmployeesIfEmpty } from "@/lib/managerDemoEmployees";
import { resolveUserAvatarUrl } from "@/lib/userAvatar";

export default async function ManagerEmployeesPage() {
  const user = await requireAuth();
  if (!canOpenManagerPanel(user)) redirect("/schedule");

  const loaded = await catchDb("manager/employees", async () => {
    await ensureManagerDemoEmployeesIfEmpty();
    const [employees, pendingUsers] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: { in: [UserRole.EMPLOYEE, UserRole.ADMIN] },
          isActive: true,
          approvalStatus: "APPROVED"
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
          telegramUsername: true,
          telegramPhotoUrl: true,
          avatarUpdatedAt: true,
          color: true
        }
      }),
      prisma.user.findMany({
        where: { approvalStatus: "PENDING", isActive: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          phone: true,
          telegramUsername: true,
          createdAt: true
        }
      })
    ]);
    return { employees, pendingUsers };
  });
  if (!loaded.ok) return <ServiceUnavailable scope="manager/employees" />;

  const { employees, pendingUsers } = loaded.data;

  return (
    <div className="space-y-6 pb-4">
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

      <PendingApprovalsPanel
        users={pendingUsers.map((u) => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          telegramUsername: u.telegramUsername,
          createdAt: u.createdAt.toISOString()
        }))}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-display text-muted">В штате</h2>
        <ManagerEmployeesClient
          employees={employees.map((u) => ({
            id: u.id,
            name: u.name,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            phone: u.phone,
            telegramUsername: u.telegramUsername,
            telegramPhotoUrl: resolveUserAvatarUrl(u),
            color: u.color
          }))}
        />
      </section>
    </div>
  );
}
