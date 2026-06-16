"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveUserRegistration, rejectUserRegistration } from "@/app/actions";
import { formatPhoneDisplay } from "@/lib/formatPhone";

export type PendingUserRow = {
  id: string;
  name: string;
  phone: string | null;
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
        <p className="text-sm text-muted">Новые регистрации по телефону и паролю</p>
      </div>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 px-3 py-2">
            <span className="font-medium">{u.name}</span>
            {u.phone ? (
              <span className="text-sm tabular-nums text-muted">{formatPhoneDisplay(u.phone)}</span>
            ) : null}
            <span className="text-xs text-muted">
              {new Date(u.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                className="btn-primary text-xs"
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
                className="btn-secondary text-xs"
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
