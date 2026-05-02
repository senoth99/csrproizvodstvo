"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserX, X } from "lucide-react";
import {
  addAllowedTelegramUser,
  adminSetTelegramUserManager,
  adminUpdateUserProfile,
  deleteEmployeeByUsername,
  revokeTelegramAccessByUsername
} from "@/app/actions";
import { UserRole } from "@/lib/enums";
import { UserAvatar } from "@/components/UserAvatar";

type AllowedRow = {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  isManager: boolean;
};

type UserRow = {
  id: string;
  username: string;
  role: string;
  firstName: string;
  lastName: string;
  name: string;
  isActive: boolean;
  isManager: boolean;
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
  isManager: boolean;
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
  const [inviteAsManager, setInviteAsManager] = useState(false);
  const [selected, setSelected] = useState<MergedRow | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editIsManager, setEditIsManager] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [managerToggleError, setManagerToggleError] = useState("");
  const router = useRouter();
  const superAdminUsername = "contact_voropaev";

  useEffect(() => {
    if (selected) {
      setEditIsManager(selected.isManager);
      setManagerToggleError("");
    }
  }, [selected]);

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
        lastName: u.lastName,
        accessRowId: undefined,
        isManager: u.isManager
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
        accessRowId: r.id,
        isManager: r.isManager ?? existing?.isManager ?? false
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
        lastName: superAdminFallback?.lastName ?? "",
        isManager: false
      });
    }
    return list;
  })();

  const trimmedInvite = username.trim().toLowerCase().replace(/^@/, "");
  const isInvitingSuperAdmin = trimmedInvite === superAdminUsername;

  return (
    <div className="space-y-3">
      <form
        className="card grid gap-2 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            try {
              await addAllowedTelegramUser({
                username,
                isManager: isInvitingSuperAdmin ? false : inviteAsManager
              });
              setUsername("");
              setInviteAsManager(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Ошибка сохранения");
            }
          });
        }}
      >
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" />
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted md:mr-auto md:justify-start">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 rounded border-border accent-foreground"
              checked={inviteAsManager}
              disabled={isInvitingSuperAdmin}
              onChange={(e) => setInviteAsManager(e.target.checked)}
            />
            <span>{isInvitingSuperAdmin ? "Суперадмину флаг не нужен" : "Руководитель"}</span>
          </label>
          <button className="btn-primary w-full shrink-0 md:w-auto" disabled={pending || !username.trim()}>
            {pending ? "Сохраняем..." : "Добавить доступ"}
          </button>
        </div>
        {error ? <p className="text-sm font-medium text-foreground/85 md:col-span-2">{error}</p> : null}
      </form>

      <div className="space-y-2">
        {merged.map((row) => (
          <div key={row.username} className="card flex w-full items-center justify-between gap-2 text-left">
            <div className="flex min-w-0 items-center gap-2">
              <UserAvatar name={row.name} size="md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="truncate">{row.name}</span>
                  {row.isManager && row.role !== UserRole.SUPER_ADMIN ? (
                    <span className="shrink-0 rounded-full border border-muted/35 bg-muted/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      Руководитель
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted">@{row.username}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
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
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:border-red-400/40 hover:text-red-400"
                disabled={
                  pending ||
                  !row.accessRowId ||
                  row.role === UserRole.SUPER_ADMIN ||
                  row.username === superAdminUsername
                }
                title="Отозвать доступ"
                aria-label={`Отозвать доступ @${row.username}`}
                onClick={() => {
                  if (
                    !row.accessRowId ||
                    row.role === UserRole.SUPER_ADMIN ||
                    row.username === superAdminUsername
                  ) {
                    return;
                  }
                  if (!window.confirm(`Отозвать доступ у @${row.username}?`)) return;
                  setError("");
                  start(async () => {
                    try {
                      await revokeTelegramAccessByUsername(row.username);
                      if (selected?.username === row.username) setSelected(null);
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Не удалось отозвать доступ");
                    }
                  });
                }}
              >
                <UserX size={15} aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-background/85 p-3 backdrop-blur-[2px]">
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

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-border accent-foreground"
                checked={editIsManager}
                disabled={
                  pending ||
                  selected.role === UserRole.SUPER_ADMIN ||
                  selected.username === superAdminUsername ||
                  !selected.accessRowId
                }
                onChange={(e) => {
                  const v = e.target.checked;
                  setEditIsManager(v);
                  setManagerToggleError("");
                  start(async () => {
                    try {
                      if (!selected.accessRowId) return;
                      if (selected.username === superAdminUsername || selected.role === UserRole.SUPER_ADMIN)
                        return;
                      await adminSetTelegramUserManager({ username: selected.username, isManager: v });
                    } catch (err) {
                      setEditIsManager(!v);
                      setManagerToggleError(err instanceof Error ? err.message : "Ошибка");
                    }
                  });
                }}
              />
              <span>Панель руководителя (роль руководителя)</span>
            </label>
            {!selected.accessRowId &&
            selected.username !== superAdminUsername &&
            selected.role !== UserRole.SUPER_ADMIN ? (
              <p className="mt-2 text-[11px] text-muted">
                Чтобы включить флаг, пользователь должен быть в списке доступа (добавьте @username основной формой).
              </p>
            ) : null}
            {managerToggleError ? <p className="mt-2 text-xs font-medium text-foreground/85">{managerToggleError}</p> : null}

            <div className="mt-3 grid gap-2">
              <input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} placeholder="Фамилия" />
              <input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} placeholder="Имя" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
                  disabled={
                    pending ||
                    selected.role === UserRole.SUPER_ADMIN ||
                    selected.username === superAdminUsername
                  }
                  onClick={() =>
                    start(async () => {
                      if (selected.role === UserRole.SUPER_ADMIN || selected.username === superAdminUsername)
                        return;
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
                  className="btn-secondary border-muted/45 text-muted"
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
