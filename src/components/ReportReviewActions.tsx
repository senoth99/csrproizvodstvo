"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptShiftReportWithAccrual } from "@/app/actions";
import { ShiftReportStatus } from "@/lib/enums";
import { formatMoneyRu } from "@/lib/utils";

export type ReportReviewActionsProps = {
  reportId: string;
  status: string;
  accrualAmountCents: number | null;
  acceptedByName: string | null;
  isAdmin: boolean;
};

export function ReportReviewActions({
  reportId,
  status,
  accrualAmountCents,
  acceptedByName,
  isAdmin
}: ReportReviewActionsProps) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "accrual">("idle");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!isAdmin) return null;

  if (status === ShiftReportStatus.ACCEPTED) {
    return (
      <div className="card space-y-2 border-accent/40 bg-accent/12">
        <p className="text-xs font-bold uppercase tracking-display text-foreground">Отчёт принят</p>
        {accrualAmountCents != null ? (
          <p className="text-sm text-muted">
            Начислено за смену:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatMoneyRu(accrualAmountCents / 100)}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted">Начисление за этот отчёт не зафиксировано в системе.</p>
        )}
        {acceptedByName ? (
          <p className="text-xs text-muted">Проверил: {acceptedByName}</p>
        ) : null}
      </div>
    );
  }

  if (status !== ShiftReportStatus.PENDING_REVIEW) return null;

  if (step === "idle") {
    return (
      <button
        type="button"
        className="btn-primary w-full"
        disabled={pending}
        onClick={() => {
          setError("");
          setStep("accrual");
        }}
      >
        Отчёт проверен
      </button>
    );
  }

  return (
    <div className="card space-y-4 border-highlight/35 bg-highlight/[0.06]">
      <p className="text-xs font-bold uppercase tracking-display text-foreground">Начисление за смену</p>
      <p className="text-xs leading-relaxed text-muted">
        Сумма будет добавлена к балансу сотрудника и отобразится в истории выплат как начисление.
      </p>
      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-display text-muted">Сумма, ₽</label>
        <input
          type="number"
          inputMode="decimal"
          step="1"
          min="1"
          className="w-full text-lg font-semibold tabular-nums"
          value={amount}
          disabled={pending}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Например, 4500"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          className="btn-secondary flex-1"
          disabled={pending}
          onClick={() => {
            setStep("idle");
            setError("");
          }}
        >
          Назад
        </button>
        <button
          type="button"
          className="btn-primary flex-[1.15]"
          disabled={pending}
          onClick={() => {
            const n = Number(String(amount).trim().replace(",", "."));
            setError("");
            if (!Number.isFinite(n) || n <= 0) {
              setError("Введите сумму больше нуля");
              return;
            }
            start(async () => {
              try {
                await acceptShiftReportWithAccrual({ reportId, amountRub: n });
                setStep("idle");
                setAmount("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Ошибка");
              }
            });
          }}
        >
          {pending ? "Сохраняем…" : "Начислить и принять"}
        </button>
      </div>
      {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}
    </div>
  );
}
