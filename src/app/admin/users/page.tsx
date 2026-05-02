import { generateAccessToken, revokeAccessToken } from "@/app/actions";
import { RoleBadge } from "@/components/RoleBadge";
import { UserForm } from "@/components/UserForm";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const wrapped = await catchDb("admin/users", () =>
    prisma.user.findMany({ include: { accessTokens: true }, orderBy: { createdAt: "desc" } })
  );
  if (!wrapped.ok) return <ServiceUnavailable scope="admin/users" />;
  const users = wrapped.data;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Пользователи</h1>
      <UserForm />
      {users.map((u) => (
        <div key={u.id} className="card flex flex-wrap items-center gap-2">
          <span className="font-semibold">{u.name}</span>
          <RoleBadge role={u.role} />
          <form action={async () => { "use server"; const link = await generateAccessToken(u.id); console.log(`Ссылка входа ${u.name}: ${link}`); }}>
            <button className="btn-secondary">Сгенерировать ссылку входа</button>
          </form>
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
