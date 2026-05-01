"use client";

import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { addAllowedTelegramUser, adminUpdateUserProfile, deleteEmployeeByUsername, revokeTelegramAccessByUsername } from "@/app/actions";
import { UserRole } from "@/lib/enums";
import { UserAvatar } from "@/components/UserAvatar";

type AllowedRow = {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
};

type UserRow = {
  id: string;
  username: string;
  role: string;
  firstName: string;
  lastName: string;
  name: string;
  isActive: boolean;
};

type SuperAdminFallback = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
};

type MergedRow = {
  username: string;
  role: string;
  isActive: boolean;
  userId?: string;
  name: string;
  firstName: string;
  lastName: string;
  accessRowId?: string;
};

export function TelegramAccessForm({
  rows,
  users,
  superAdminFallback
}: {
  rows: AllowedRow[];
  users: UserRow[];
  superAdminFallback: SuperAdminFallback | null;
}) {
  const [username, setUsername] = useState("");
  const [selected, setSelected] = useState<MergedRow | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const superAdminUsername = "contact_voropaev";
  const merged = (() => {
    const map = new Map<string, MergedRow>();
    for (const u of users) {
      if (!u.username) continue;
      map.set(u.username, {
        username: u.username,
        role: u.role,
        isActive: u.isActive,
        userId: u.id,
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName
      });
    }
    for (const r of rows) {
      const existing = map.get(r.username);
      map.set(r.username, {
        username: r.username,
        role: existing?.role ?? r.role,
        isActive: r.isActive,
        userId: existing?.userId,
        name: existing?.name ?? `@${r.username}`,
        firstName: existing?.firstName ?? "",
        lastName: existing?.lastName ?? "",
        accessRowId: r.id
      });
    }
    const list = Array.from(map.values()).sort((a, b) => {
      if (a.role === UserRole.SUPER_ADMIN) return -1;
      if (b.role === UserRole.SUPER_ADMIN) return 1;
      return a.username.localeCompare(b.username);
    });
    if (!list.some((u) => u.username === superAdminUsername)) {
      list.unshift({
        username: superAdminUsername,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        userId: superAdminFallback?.id,
        name: superAdminFallback?.name ?? "@contact_voropaev",
        firstName: superAdminFallback?.firstName ?? "",
        lastName: superAdminFallback?.lastName ?? ""
      });
    }
    return list;
  })();

  return (
    <div className="space-y-3">
      <form
        className="card grid gap-2 md:grid-cols-2"
        action={() =>
          start(async () => {
            setError("");
            try {
              await addAllowedTelegramUser({ username });
              setUsername("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Ошибка сохранения");
            }
          })
        }
      >
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" />
        <button className="btn-primary" disabled={pending || !username.trim()}>
          {pending ? "Сохраняем..." : "Добавить доступ"}
        </button>
        {error ? <p className="text-sm text-red-400 md:col-span-2">{error}</p> : null}
      </form>

      <div className="space-y-2">
        {merged.map((row) => (
          <div key={row.username} className="card flex w-full items-center justify-between gap-2 text-left">
            <div className="flex items-center gap-2">
              <UserAvatar name={row.name} size="md" />
              <div>
                <div className="font-semibold">{row.name}</div>
                <div className="text-xs text-muted">@{row.username}</div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:text-foreground"
              onClick={() => {
                setSelected(row);
                setEditFirstName(row.firstName);
                setEditLastName(row.lastName);
              }}
              aria-label={`Редактировать @${row.username}`}
            >
              <Pencil size={15} />
            </button>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-3">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Закрыть"
            onClick={() => setSelected(null)}
          />
          <div className="card relative w-full max-w-md">
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:text-foreground"
              onClick={() => setSelected(null)}
              aria-label="Закрыть попап"
            >
              <X size={14} />
            </button>
            <h3 className="text-lg font-semibold">Профиль пользователя</h3>
            <p className="text-sm text-muted">@{selected.username}</p>
            <div className="mt-3 grid gap-2">
              <input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Фамилия"
              />
              <input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="Имя"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="btn-primary"
                disabled={pending || !selected.userId || !editFirstName.trim() || !editLastName.trim()}
                onClick={() =>
                  start(async () => {
                    if (!selected.userId) return;
                    await adminUpdateUserProfile({
                      userId: selected.userId,
                      firstName: editFirstName,
                      lastName: editLastName
                    });
                    setSelected(null);
                  })
                }
              >
                Сохранить ФИ
              </button>
              {selected.accessRowId ? (
                <button
                  className="btn-secondary"
                  disabled={pending || selected.role === UserRole.SUPER_ADMIN || selected.username === superAdminUsername}
                  onClick={() =>
                    start(async () => {
                      if (selected.role === UserRole.SUPER_ADMIN || selected.username === superAdminUsername) return;
                      await revokeTelegramAccessByUsername(selected.username);
                      setSelected(null);
                    })
                  }
                >
                  Отозвать доступ
                </button>
              ) : null}
              {selected.username !== superAdminUsername && selected.role !== UserRole.SUPER_ADMIN ? (
                <button
                  className="btn-secondary border-red-500/40 text-red-400"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await deleteEmployeeByUsername(selected.username);
                      setSelected(null);
                    })
                  }
                >
                  Удалить сотрудника
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
