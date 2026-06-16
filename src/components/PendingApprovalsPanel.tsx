"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveUserRegistration, rejectUserRegistration } from "@/app/actions";
import { formatPhoneDisplay } from "@/lib/formatPhone";

export type PendingUserRow = {
  id: string;
  name: string;
  phone: string | null;
  telegramUsername?: string | null;
  createdAt: string;
};

export function PendingApprovalsPanel({ users }: { users: PendingUserRow[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!users.length) return null;

  return (
    <section className="card space-y-3 border-amber-500/40 bg-amber-500/[0.06]">
      <div>
        <h2 className="text-lg font-semibold">Ожидают одобрения</h2>
        <p className="text-sm text-muted">Новые регистрации — одобрите или отклоните доступ</p>
      </div>
      <ul className="space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-col gap-3 rounded-lg border border-border/80 px-3 py-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">{u.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {u.phone ? <span className="tabular-nums">{formatPhoneDisplay(u.phone)}</span> : null}
                {u.telegramUsername ? <span>@{u.telegramUsername}</span> : null}
                <span className="text-xs">
                  {new Date(u.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <button
                type="button"
                className="btn-primary min-h-11 touch-manipulation text-xs"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await approveUserRegistration(u.id);
                    router.refresh();
                  })
                }
              >
                Одобрить
              </button>
              <button
                type="button"
                className="btn-secondary min-h-11 touch-manipulation text-xs"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await rejectUserRegistration(u.id);
                    router.refresh();
                  })
                }
              >
                Отклонить
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
