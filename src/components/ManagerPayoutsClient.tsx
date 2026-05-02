"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CircleDollarSign, WalletCards, X } from "lucide-react";
import { managerRecordPayout } from "@/app/actions";
import { UserAvatar } from "@/components/UserAvatar";
import { formatMoneyRu } from "@/lib/utils";

export type ManagerPayoutListItem = {
  id: string;
  name: string;
  telegramUsername: string | null;
  isActive: boolean;
  color: string;
  payoutDebtCents: number;
};

type Props = {
  employees: ManagerPayoutListItem[];
};

type ModalState = null | { emp: ManagerPayoutListItem };

export function ManagerPayoutsClient({ employees }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [amountRub, setAmountRub] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalDebtCents = useMemo(
    () => employees.reduce((acc, u) => acc + u.payoutDebtCents, 0),
    [employees]
  );

  const submit = () => {
    if (!modal) return;
    const parsed = Number(amountRub.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Введите корректную сумму.");
      return;
    }
    setError(null);
    const { emp } = modal;
    startTransition(async () => {
      try {
        await managerRecordPayout({ userId: emp.id, amountRub: parsed });
        setModal(null);
        setAmountRub("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось сохранить.");
      }
    });
  };

  return (
    <>
      <section className="card flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-transparent">
          <WalletCards className="h-5 w-5 text-muted" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">Задолженность</p>
          <p className="text-2xl font-bold text-foreground">{formatMoneyRu(totalDebtCents / 100)}</p>
        </div>
      </section>

      <ul className="space-y-2">
        {employees.map((emp) => (
          <li key={emp.id}>
            <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar name={emp.name} color={emp.color} size="md" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{emp.name}</p>
                  <p className="truncate text-xs text-muted">
                    {emp.telegramUsername ? `@${emp.telegramUsername}` : "Без Telegram-ника"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:text-right">
                <p className="text-center text-sm font-semibold tabular-nums sm:min-w-[5.5rem] sm:text-right">
                  {formatMoneyRu(emp.payoutDebtCents / 100)}
                </p>
                <div className="flex flex-wrap justify-center gap-1 sm:justify-end">
                  <button
                    type="button"
                    className="inline-flex min-h-10 flex-1 touch-manipulation items-center justify-center gap-1 rounded-xl border border-border bg-transparent px-2.5 py-2 text-xs font-medium text-foreground transition hover:bg-foreground/[0.08] sm:flex-initial"
                    onClick={() => {
                      setModal({ emp });
                      setAmountRub("");
                      setError(null);
                    }}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Выплатить
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {modal ? (
        <div className="manager-modal-overlay">
          <div className="manager-modal-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ui-section-kicker">Выплата сотруднику</p>
                <h3 className="mt-1 text-lg font-bold">{modal.emp.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  Текущий остаток:{" "}
                  <span className="font-semibold text-foreground">
                    {formatMoneyRu(modal.emp.payoutDebtCents / 100)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:text-foreground"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="text-xs text-muted">Сколько выплатили (₽)</span>
              <input
                autoFocus
                value={amountRub}
                onChange={(e) => setAmountRub(e.target.value)}
                inputMode="decimal"
                placeholder="Например, 3000"
                className="mt-1 w-full"
              />
            </label>
            {error ? <p className="mt-2 text-xs font-medium text-foreground/85">{error}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="btn-primary inline-flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <CircleDollarSign className="h-4 w-4" />
                {isPending ? "Сохраняем..." : "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
