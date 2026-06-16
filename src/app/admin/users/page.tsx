import { getMonthlyWorkedMinutesByUser, revokeAccessToken } from "@/app/actions";
import { AdminAccessTokenActions } from "@/components/AdminAccessTokenActions";
import { PendingApprovalsPanel } from "@/components/PendingApprovalsPanel";
import { RoleBadge } from "@/components/RoleBadge";
import { UserForm } from "@/components/UserForm";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { formatWorkedMinutes, getCurrentAppMonth } from "@/lib/workedHours";
import { formatPhoneDisplay } from "@/lib/formatPhone";

export default async function AdminUsersPage() {
  await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const monthLabel = getCurrentAppMonth().label;
  const wrapped = await catchDb("admin/users", async () => {
    const [users, workedMap, pendingUsers] = await Promise.all([
      prisma.user.findMany({ include: { accessTokens: true }, orderBy: { createdAt: "desc" } }),
      getMonthlyWorkedMinutesByUser(),
      prisma.user.findMany({
        where: { approvalStatus: "PENDING", isActive: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, phone: true, createdAt: true }
      })
    ]);
    return { users, workedMap, pendingUsers };
  });
  if (!wrapped.ok) return <ServiceUnavailable scope="admin/users" />;
  const { users, workedMap, pendingUsers } = wrapped.data;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <p className="text-sm text-muted capitalize">Отработано за {monthLabel}</p>
      </div>
      <PendingApprovalsPanel
        users={pendingUsers.map((u) => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          createdAt: u.createdAt.toISOString()
        }))}
      />
      <UserForm />
      {users.map((u) => (
        <div key={u.id} className="card flex flex-wrap items-center gap-2">
          <span className="font-semibold">{u.name}</span>
          {u.phone ? (
            <span className="text-sm tabular-nums text-muted">{formatPhoneDisplay(u.phone)}</span>
          ) : null}
          <RoleBadge role={u.role} />
          <span className="rounded-sm border border-border px-2 py-1 text-xs tabular-nums text-muted">
            {formatWorkedMinutes(workedMap.get(u.id) ?? 0)} за месяц
          </span>
          <AdminAccessTokenActions userId={u.id} userName={u.name} />
          {u.accessTokens.filter((t) => t.isActive).map((t) => (
            <form key={t.id} action={async () => { "use server"; await revokeAccessToken(t.id); }}>
              <button className="btn-secondary">Отозвать токен</button>
            </form>
          ))}
        </div>
      ))}
    </div>
  );
}
