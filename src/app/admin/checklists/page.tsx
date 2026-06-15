import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAdminZoneChecklists } from "@/app/actions";
import { AdminZoneChecklistsClient } from "@/components/AdminZoneChecklistsClient";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function AdminChecklistsPage() {
  await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const zones = await getAdminZoneChecklists();

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="group inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted transition hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" aria-hidden />
        В админку
      </Link>
      <h1 className="text-2xl font-bold">Чеклисты по зонам</h1>
      <p className="text-sm text-muted">
        Настройте пункты для каждой зоны — сотрудник отмечает их при сдаче отчёта по смене.
      </p>
      <AdminZoneChecklistsClient zones={zones} />
    </div>
  );
}
