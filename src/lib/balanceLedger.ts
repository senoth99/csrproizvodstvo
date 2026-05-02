/** Движения баланса (выплаты/начисления) пишутся в AuditLog. */

export const BALANCE_AUDIT_ACTIONS = ["MANAGER_RECORD_PAYOUT", "MANAGER_RECORD_ACCRUAL"] as const;

export type BalanceMovementKind = "payout" | "accrual";

export function auditActionToMovementKind(action: string): BalanceMovementKind | null {
  if (action === "MANAGER_RECORD_PAYOUT") return "payout";
  if (action === "MANAGER_RECORD_ACCRUAL") return "accrual";
  return null;
}

export function parseBalancePayload(payload: string | null): {
  amountRub: number;
  prevDebtCents?: number;
  nextDebtCents?: number;
} | null {
  if (!payload?.trim()) return null;
  try {
    const o = JSON.parse(payload) as Record<string, unknown>;
    if (typeof o.amountRub === "number" && Number.isFinite(o.amountRub) && o.amountRub >= 0) {
      return {
        amountRub: o.amountRub,
        prevDebtCents: typeof o.prevDebtCents === "number" ? o.prevDebtCents : undefined,
        nextDebtCents: typeof o.nextDebtCents === "number" ? o.nextDebtCents : undefined
      };
    }
    const prev = o.prevDebtCents;
    const next = o.nextDebtCents;
    if (typeof prev === "number" && typeof next === "number") {
      return {
        amountRub: Math.round(Math.abs(prev - next)) / 100,
        prevDebtCents: prev,
        nextDebtCents: next
      };
    }
  } catch {
    /* empty */
  }
  return null;
}
