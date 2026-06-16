"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Heart, LogIn, Shield } from "lucide-react";
import { superAdminSetEmployeeAdminRole, updateEmployeeNdaSigned } from "@/app/actions";
import { UserAvatar } from "@/components/UserAvatar";
import { RoleBadge } from "@/components/RoleBadge";
import type { ManagerEmployeeListItem } from "@/components/ManagerEmployeesClient";
import { UserRole } from "@/lib/enums";
import { isFormalNameLineRedundant } from "@/lib/displayName";
import { formatPhoneDisplay } from "@/lib/formatPhone";

type HistoryItem = { id: string; label: string; shiftLabel?: string };

type Props = {
  employee: ManagerEmployeeListItem;
  canManageAdminRole?: boolean;
  arrivalHistory?: HistoryItem[];
  likesHistory?: HistoryItem[];
};

function ToggleSwitch({
  checked,
  disabled,
  label,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center">
      <span className="relative h-9 w-[3.25rem] shrink-0 overflow-hidden rounded-full border border-border/80 bg-surface/90 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-border has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card/80">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-checked={checked}
          aria-label={label}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 m-0 h-full w-full min-h-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 opacity-0 shadow-none ring-0 outline-none focus:border-0 focus:ring-0 focus:ring-offset-0 disabled:cursor-wait"
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-border/60 transition-colors duration-200 peer-checked:bg-muted/50"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-border/80 bg-card/90 transition-[transform,background-color] duration-200 ease-out peer-checked:translate-x-[1.25rem] peer-checked:bg-foreground/90"
          aria-hidden
        />
      </span>
    </label>
  );
}

export function ManagerEmployeeProfileClient({
  employee,
  canManageAdminRole = false,
  arrivalHistory = [],
  likesHistory = []
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ndaSigned, setNdaSigned] = useState(Boolean(employee.ndaSigned));
  const [isAdmin, setIsAdmin] = useState(employee.role === UserRole.ADMIN);

  useEffect(() => {
    setNdaSigned(Boolean(employee.ndaSigned));
  }, [employee.id, employee.ndaSigned]);

  useEffect(() => {
    setIsAdmin(employee.role === UserRole.ADMIN);
  }, [employee.id, employee.role]);

  function handleNdaChange(next: boolean) {
    const prev = ndaSigned;
    setNdaSigned(next);
    startTransition(() => {
      void (async () => {
        try {
          await updateEmployeeNdaSigned({ userId: employee.id, ndaSigned: next });
          router.refresh();
        } catch {
          setNdaSigned(prev);
        }
      })();
    });
  }

  function handleAdminRoleChange(next: boolean) {
    const prev = isAdmin;
    setIsAdmin(next);
    startTransition(() => {
      void (async () => {
        try {
          await superAdminSetEmployeeAdminRole({ userId: employee.id, isAdmin: next });
          router.refresh();
        } catch {
          setIsAdmin(prev);
        }
      })();
    });
  }

  return (
    <div className="card flex max-w-lg flex-col overflow-hidden p-0">
      <div className="flex items-start gap-3 border-b border-border/80 px-4 py-4">
        <UserAvatar
          name={employee.name}
          photoUrl={employee.telegramPhotoUrl}
          color={employee.color}
          size="lg"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 id="employee-detail-title" className="text-lg font-bold leading-none tracking-tight">
              {employee.name}
            </h1>
            {employee.role === UserRole.ADMIN ? <RoleBadge role={UserRole.ADMIN} /> : null}
          </div>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] leading-none text-muted">
            {employee.telegramUsername ? `@${employee.telegramUsername}` : "—"}
          </p>
          <p className="mt-2 text-sm tabular-nums text-foreground/90">{formatPhoneDisplay(employee.phone)}</p>
          {employee.firstName || employee.lastName
            ? !isFormalNameLineRedundant(employee.name, employee.firstName, employee.lastName) ? (
                <p className="mt-2 text-xs leading-snug text-muted">
                  {[employee.lastName, employee.firstName].filter(Boolean).join(" ")}
                </p>
              ) : null
            : null}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {canManageAdminRole ? (
          <section className="rounded-xl bg-surface/50 p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted" aria-hidden />
              <p className="ui-section-kicker-strong">Администратор</p>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-muted">
              Доступ к разделам админки: пользователи, зоны, лимиты, логи.
            </p>
            <div className="mt-3 flex justify-center rounded-lg border border-dashed border-border/70 bg-card/80 px-3 py-2">
              <ToggleSwitch
                checked={isAdmin}
                disabled={pending}
                label="Роль администратора"
                onChange={handleAdminRoleChange}
              />
            </div>
          </section>
        ) : null}

        <section className="rounded-xl bg-surface/50 p-3">
          <p className="ui-section-kicker-strong">NDA подписано</p>
          <div className="mt-3 flex justify-center rounded-lg border border-dashed border-border/70 bg-card/80 px-3 py-2">
            <ToggleSwitch
              checked={ndaSigned}
              disabled={pending}
              label="NDA подписано"
              onChange={handleNdaChange}
            />
          </div>
        </section>

        <section className="rounded-xl bg-surface/50 p-3">
          <div className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-muted" aria-hidden />
            <p className="ui-section-kicker-strong">История приходов</p>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted">Отметки по QR-коду на производстве.</p>
          {arrivalHistory.length > 0 ? (
            <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {arrivalHistory.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-sm"
                >
                  <span className="font-medium tabular-nums">{item.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Пока нет отметок прихода.</p>
          )}
        </section>

        <section className="rounded-xl bg-surface/50 p-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-highlight" aria-hidden />
            <p className="ui-section-kicker-strong">Полученные лайки</p>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted">Лайки анонимны — не видно, кто поставил.</p>
          {likesHistory.length > 0 ? (
            <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {likesHistory.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-sm"
                >
                  <p className="font-medium tabular-nums">{item.label}</p>
                  {item.shiftLabel ? (
                    <p className="mt-0.5 text-xs text-muted">{item.shiftLabel}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Пока нет лайков.</p>
          )}
        </section>
      </div>
    </div>
  );
}
