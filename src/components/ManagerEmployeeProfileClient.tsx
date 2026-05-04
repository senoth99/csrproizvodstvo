"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateEmployeeNdaSigned } from "@/app/actions";
import { UserAvatar } from "@/components/UserAvatar";
import type { ManagerEmployeeListItem } from "@/components/ManagerEmployeesClient";
import { isFormalNameLineRedundant } from "@/lib/displayName";

type Props = { employee: ManagerEmployeeListItem };

export function ManagerEmployeeProfileClient({ employee }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ndaSigned, setNdaSigned] = useState(Boolean(employee.ndaSigned));

  useEffect(() => {
    setNdaSigned(Boolean(employee.ndaSigned));
  }, [employee.id, employee.ndaSigned]);

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
          <h1 id="employee-detail-title" className="text-lg font-bold leading-none tracking-tight">
            {employee.name}
          </h1>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] leading-none text-muted">
            {employee.telegramUsername ? `@${employee.telegramUsername}` : "—"}
          </p>
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
        <section className="rounded-xl bg-surface/50 p-3">
          <p className="ui-section-kicker-strong">NDA подписано</p>
          <div className="mt-3 flex justify-center rounded-lg border border-dashed border-border/70 bg-card/80 px-3 py-2">
            <label className="inline-flex cursor-pointer items-center justify-center">
              <span className="relative h-9 w-[3.25rem] shrink-0 overflow-hidden rounded-full border border-border/80 bg-surface/90 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-border has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card/80">
                <input
                  type="checkbox"
                  role="switch"
                  checked={ndaSigned}
                  disabled={pending}
                  aria-checked={ndaSigned}
                  aria-label="NDA подписано"
                  onChange={(e) => handleNdaChange(e.target.checked)}
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
          </div>
        </section>
      </div>
    </div>
  );
}
