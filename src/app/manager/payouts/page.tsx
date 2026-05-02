import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ManagerPayoutsClient, type ManagerPayoutListItem } from "@/components/ManagerPayoutsClient";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireAuth } from "@/lib/auth";
import { catchDb } from "@/lib/dbBoundary";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { ensureManagerDemoEmployeesIfEmpty } from "@/lib/managerDemoEmployees";
import { findEmployeesWithPayoutDebtForManagerSafe } from "@/lib/prismaSafeUserInclude";

export default async function ManagerPayoutsPage() {
  const user = await requireAuth();
  if (!canOpenManagerPanel(user)) redirect("/schedule");

  await ensureManagerDemoEmployeesIfEmpty();

  const loaded = await catchDb("manager/payouts", () => findEmployeesWithPayoutDebtForManagerSafe());
  if (!loaded.ok) return <ServiceUnavailable scope="manager/payouts" />;

  const employees: ManagerPayoutListItem[] = loaded.data;

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
      <h1 className="text-2xl font-bold tracking-tight">Выплаты</h1>

      <ManagerPayoutsClient employees={employees} />
    </div>
  );
}
