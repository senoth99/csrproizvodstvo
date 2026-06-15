import Link from "next/link";
import { AdminWorkplaceQrDownload } from "@/components/AdminWorkplaceQrDownload";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";

export default async function AdminPage() {
  await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Админка</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/admin/logs" className="card">Логи</Link>
        <Link href="/admin/checklists" className="card">Чеклисты зон</Link>
      </div>
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">QR на производстве</h2>
        <p className="text-sm text-muted">
          Распечатайте QR и повесьте на вход. Сканирование начинает смену (если она запланирована на сегодня) и фиксирует приход.
        </p>
        <AdminWorkplaceQrDownload />
      </section>
    </div>
  );
}
