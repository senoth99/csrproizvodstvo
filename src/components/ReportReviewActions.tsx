"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptShiftReportWithAccrual } from "@/app/actions";
import { ShiftReportStatus } from "@/lib/enums";
import { formatMoneyRu } from "@/lib/utils";

function parseNonNegativeRub(raw: string): number {
  const t = String(raw).trim().replace(",", ".");
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export type ReportReviewActionsProps = {
  reportId: string;
  status: string;
  accrualAmountCents: number | null;
  accrualAppearanceCents: number | null;
  accrualWorkCents: number | null;
  acceptedByName: string | null;
  isAdmin: boolean;
};

export function ReportReviewActions({
  reportId,
  status,
  accrualAmountCents,
  accrualAppearanceCents,
  accrualWorkCents,
  acceptedByName,
  isAdmin
}: ReportReviewActionsProps) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "accrual">("idle");
  const [amountAppearance, setAmountAppearance] = useState("");
  const [amountWork, setAmountWork] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const previewTotalRub = useMemo(() => {
    const a = parseNonNegativeRub(amountAppearance);
    const w = parseNonNegativeRub(amountWork);
    if (Number.isNaN(a) || Number.isNaN(w)) return null;
    return a + w;
  }, [amountAppearance, amountWork]);

  if (!isAdmin) return null;

  const hasStoredBreakdown =
    accrualAmountCents != null &&
    accrualAppearanceCents != null &&
    accrualWorkCents != null;

  if (status === ShiftReportStatus.ACCEPTED) {
    return (
      <div className="card space-y-2 border-accent/40 bg-accent/12">
        <p className="text-xs font-bold uppercase tracking-display text-foreground">Отчёт принят</p>
        {accrualAmountCents != null ? (
          hasStoredBreakdown ? (
            <div className="space-y-3 rounded-lg border border-border/60 bg-card/50 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Начисление</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">За выход</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {formatMoneyRu(accrualAppearanceCents / 100)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">За работу</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {formatMoneyRu(accrualWorkCents / 100)}
                  </p>
                </div>
              </div>
              <div className="border-t border-border/70 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Итого</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                  {formatMoneyRu(accrualAmountCents / 100)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Начислено за смену:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoneyRu(accrualAmountCents / 100)}
              </span>
            </p>
          )
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
        Укажите суммы по двум статьям — на баланс сотрудника попадёт <span className="font-medium text-foreground">их сумма</span>
        . В истории выплат отобразится одно начисление на общую сумму.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-card/40 px-3 py-2.5">
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-display text-muted">За выход, ₽</label>
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            className="w-full text-lg font-semibold tabular-nums"
            value={amountAppearance}
            disabled={pending}
            onChange={(e) => setAmountAppearance(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="rounded-lg border border-border/70 bg-card/40 px-3 py-2.5">
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-display text-muted">За работу, ₽</label>
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            className="w-full text-lg font-semibold tabular-nums"
            value={amountWork}
            disabled={pending}
            onChange={(e) => setAmountWork(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-border/80 bg-surface/40 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Итого к начислению</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
          {previewTotalRub === null ? "—" : formatMoneyRu(previewTotalRub)}
        </p>
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
            setError("");
            const appearanceRub = parseNonNegativeRub(amountAppearance);
            const workRub = parseNonNegativeRub(amountWork);
            if (Number.isNaN(appearanceRub) || Number.isNaN(workRub)) {
              setError("Введите неотрицательные числа (можно 0 в одной из ячеек).");
              return;
            }
            if (appearanceRub + workRub <= 0) {
              setError("Сумма начисления должна быть больше нуля.");
              return;
            }
            start(async () => {
              try {
                await acceptShiftReportWithAccrual({
                  reportId,
                  amountAppearanceRub: appearanceRub,
                  amountWorkRub: workRub
                });
                setStep("idle");
                setAmountAppearance("");
                setAmountWork("");
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
