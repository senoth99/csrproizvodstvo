import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireAuth } from "@/lib/auth";
import {
  auditActionToMovementKind,
  BALANCE_AUDIT_ACTIONS,
  parseBalancePayload
} from "@/lib/balanceLedger";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { formatDateRu, formatMoneyRu } from "@/lib/utils";

export default async function MeBalancePage() {
  const user = await requireAuth();

  const loaded = await catchDb("me/balance", async () => {
    const [logs, row] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entityType: "User",
          entityId: user.id,
          action: { in: [...BALANCE_AUDIT_ACTIONS] }
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { actor: { select: { name: true } } }
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { payoutDebtCents: true }
      })
    ]);
    return { logs, payoutDebtCents: row?.payoutDebtCents ?? 0 };
  });

  if (!loaded.ok) return <ServiceUnavailable scope="me/balance" />;
  const { logs, payoutDebtCents } = loaded.data;

  try {
    return (
      <div className="space-y-4 pb-2">
      <div className="flex items-center gap-2">
        <Link
          href="/me"
          className="group inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-xl border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" aria-hidden />
          Кабинет
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Баланс</h1>

      <section className="card">
        <p className="ui-section-kicker-strong">Текущий остаток к выплате</p>
        <p className="mt-2 text-3xl font-bold tabular-nums">{formatMoneyRu(payoutDebtCents / 100)}</p>
      </section>

      <section className="space-y-2 pt-3">
        <h2 className="text-sm font-semibold text-foreground">История</h2>
        {logs.length === 0 ? (
          <div className="card text-sm text-muted">Пока истории нет</div>
        ) : (
          <ul className="space-y-2">
            {logs.filter((log) => auditActionToMovementKind(log.action)).map((log) => {
              const kind = auditActionToMovementKind(log.action)!;
              const parsed = parseBalancePayload(log.payload);
              const amountRub = parsed?.amountRub ?? null;
              const actorLabel = log.actor?.name?.trim() || "Руководитель";
              const isAccrual = kind === "accrual";
              const title = isAccrual ? "Начисление" : "Выплата";

              return (
                <li key={log.id} className="card space-y-1.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-[11px] text-muted">{formatDateRu(log.createdAt, "dd.MM.yyyy HH:mm")}</p>
                    </div>
                    {amountRub !== null ? (
                      <p
                        className={`shrink-0 text-lg font-bold tabular-nums ${
                          isAccrual ? "text-muted" : "text-foreground"
                        }`}
                      >
                        <span className="mr-0.5">{isAccrual ? "+" : "−"}</span>
                        {formatMoneyRu(amountRub)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted">—</p>
                    )}
                  </div>
                  <p className="text-[11px] text-muted">{actorLabel}</p>
                  {parsed?.nextDebtCents !== undefined ? (
                    <p className="text-[11px] text-muted/90">
                      Остаток после операции: {formatMoneyRu(parsed.nextDebtCents / 100)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </div>
    );
  } catch (e) {
    console.error("[me/balance render]", e);
    return <ServiceUnavailable scope="me/balance" />;
  }
}
