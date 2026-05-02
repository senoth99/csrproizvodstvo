import Link from "next/link";
import { ChevronRight, HandCoins, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { canOpenManagerPanel } from "@/lib/managerPanel";
export default async function ManagerPanelPage() {
  const user = await requireAuth();
  if (!canOpenManagerPanel(user)) redirect("/schedule");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold uppercase tracking-display sm:text-3xl">Панель руководителя</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/manager/employees"
          className="card flex min-h-[52px] touch-manipulation items-center gap-3 transition-colors hover:bg-foreground/[0.04]"
          aria-label="Сотрудники"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-transparent">
            <Users className="h-5 w-5 text-muted" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight">Сотрудники</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </Link>

        <Link
          href="/manager/payouts"
          className="card flex min-h-[52px] touch-manipulation items-center gap-3 transition-colors hover:bg-foreground/[0.04]"
          aria-label="Выплаты"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-transparent">
            <HandCoins className="h-5 w-5 text-muted" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight">Выплаты</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
