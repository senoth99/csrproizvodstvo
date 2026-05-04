import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";

export default async function AdminPage() {
  await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Админка</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/admin/logs" className="card">Логи</Link>
      </div>
    </div>
  );
}
