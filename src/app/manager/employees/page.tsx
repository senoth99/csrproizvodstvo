import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ManagerEmployeesClient, type ManagerEmployeeListItem } from "@/components/ManagerEmployeesClient";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { TelegramAccessForm } from "@/components/TelegramAccessForm";
import { requireAuth } from "@/lib/auth";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/enums";
import { ensureManagerDemoEmployeesIfEmpty } from "@/lib/managerDemoEmployees";

function normalizedTelegramSuperUsername(): string {
  return (process.env.TELEGRAM_ADMIN_USERNAME ?? "").trim().toLowerCase().replace(/^@/, "");
}

export default async function ManagerEmployeesPage() {
  const user = await requireAuth();
  if (!canOpenManagerPanel(user)) redirect("/schedule");

  const telegramSuperUsername = normalizedTelegramSuperUsername();

  const loaded = await catchDb("manager/employees", async () => {
    await ensureManagerDemoEmployeesIfEmpty();
    const [employees, accessRows, accessUsers] = await Promise.all([
      prisma.user.findMany({
        where: { role: UserRole.EMPLOYEE },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          telegramUsername: true,
          telegramPhotoUrl: true,
          color: true
        }
      }),
      prisma.allowedTelegramUser.findMany({
        where: { isActive: true, role: UserRole.EMPLOYEE },
        orderBy: { createdAt: "desc" }
      }),
      prisma.user.findMany({
        where: { telegramUsername: { not: null }, role: UserRole.EMPLOYEE },
        orderBy: { name: "asc" },
        select: {
          id: true,
          telegramUsername: true,
          role: true,
          firstName: true,
          lastName: true,
          name: true,
          isActive: true,
          isManager: true,
          telegramPhotoUrl: true,
          color: true
        }
      })
    ]);
    return { employees, accessRows, accessUsers };
  });
  if (!loaded.ok) return <ServiceUnavailable scope="manager/employees" />;

  const { employees, accessRows, accessUsers } = loaded.data;

  const list: ManagerEmployeeListItem[] = employees.map((u) => ({
    id: u.id,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    telegramUsername: u.telegramUsername,
    telegramPhotoUrl: u.telegramPhotoUrl,
    color: u.color
  }));

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

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-display text-muted">Доступ по Telegram</h2>
          <p className="mt-1 text-sm text-muted">
            Добавьте @username — человек сможет войти в приложение. Фото подтягиваются после первого входа через Telegram.
          </p>
        </div>
        <TelegramAccessForm
          variant="manager"
          telegramSuperUsername={telegramSuperUsername}
          rows={accessRows.map((r) => ({
            id: r.id,
            username: r.username,
            role: r.role,
            isActive: r.isActive,
            isManager: r.isManager
          }))}
          users={accessUsers.map((u) => ({
            id: u.id,
            username: (u.telegramUsername ?? "").toLowerCase(),
            role: u.role,
            firstName: u.firstName ?? "",
            lastName: u.lastName ?? "",
            name: u.name,
            isActive: u.isActive,
            isManager: u.isManager,
            photoUrl: u.telegramPhotoUrl,
            color: u.color
          }))}
          superAdminFallback={null}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-display text-muted">Список сотрудников</h2>
        <ManagerEmployeesClient employees={list} />
      </section>
    </div>
  );
}
