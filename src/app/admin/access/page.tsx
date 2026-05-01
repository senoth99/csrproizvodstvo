import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { TelegramAccessForm } from "@/components/TelegramAccessForm";

export default async function AdminAccessPage() {
  await requireRole([UserRole.SUPER_ADMIN]);
  const rows = await prisma.allowedTelegramUser.findMany({ orderBy: { createdAt: "desc" } });
  const superAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
    orderBy: { createdAt: "asc" }
  });
  const users = await prisma.user.findMany({
    where: { telegramUsername: { not: null } },
    orderBy: { createdAt: "desc" }
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Доступ по Telegram</h1>
      <p className="text-sm text-muted">Добавь @username, чтобы пользователь мог зайти в Mini App.</p>
      <TelegramAccessForm rows={rows} users={users.map((u) => ({
        id: u.id,
        username: (u.telegramUsername ?? "").toLowerCase(),
        role: u.role,
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        name: u.name,
        isActive: u.isActive
      }))} superAdminFallback={superAdmin ? {
        id: superAdmin.id,
        firstName: superAdmin.firstName ?? "",
        lastName: superAdmin.lastName ?? "",
        name: superAdmin.name
      } : null} />
    </div>
  );
}
