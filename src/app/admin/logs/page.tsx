import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";

export default async function AdminLogsPage() {
  await requireRole([UserRole.SUPER_ADMIN]);
  const wrapped = await catchDb("admin/logs", () =>
    prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 200 })
  );
  if (!wrapped.ok) return <ServiceUnavailable scope="admin/logs" />;
  const logs = wrapped.data;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Аудит логи</h1>
      {logs.map((l) => (
        <div key={l.id} className="card text-sm">
          <div>{l.actor?.name ?? "Система"} - {l.action}</div>
          <div className="text-muted">{l.entityType} / {l.entityId}</div>
        </div>
      ))}
    </div>
  );
}
