"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateMyProfile } from "@/app/actions";
import { UserAvatar } from "@/components/UserAvatar";

export function MeProfileCard({
  displayName,
  telegramUsername,
  telegramPhotoUrl,
  accentColor,
  initialFirstName,
  initialLastName
}: {
  displayName: string;
  telegramUsername: string;
  telegramPhotoUrl: string | null;
  accentColor: string;
  initialFirstName: string;
  initialLastName: string;
}) {
  const router = useRouter();
  const hasRealName = Boolean(initialFirstName.trim() && initialLastName.trim());
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [editing, setEditing] = useState(!hasRealName);
  const [pending, start] = useTransition();

  return (
    <div className="mt-1 bg-background px-4 pt-2.5 pb-3">
      <div className="flex items-start gap-2.5">
        <UserAvatar name={displayName} photoUrl={telegramPhotoUrl} color={accentColor} size="lg" />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-xl font-bold uppercase leading-none tracking-display">
                {displayName}
              </h1>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted leading-none">
                @{telegramUsername}
              </p>
            </div>
            {hasRealName ? (
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-border bg-transparent text-muted transition hover:bg-foreground/[0.07] hover:text-foreground"
                aria-label={editing ? "Закрыть редактирование имени" : "Изменить фамилию и имя"}
                aria-expanded={editing}
                disabled={pending}
                onClick={() => {
                  if (editing) {
                    setFirstName(initialFirstName);
                    setLastName(initialLastName);
                  }
                  setOk("");
                  setError("");
                  setEditing((v) => !v);
                }}
              >
                <Pencil size={15} aria-hidden />
              </button>
            ) : null}
          </div>

          {editing ? (
            <form
              className="mt-4 space-y-3 border-t border-border pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                setOk("");
                start(async () => {
                  try {
                    await updateMyProfile({ firstName, lastName });
                    setOk("Сохранено");
                    setEditing(false);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Не удалось сохранить");
                  }
                });
              }}
            >
              <p className="text-xs font-medium text-muted">Как в паспорте</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Фамилия"
                  autoComplete="family-name"
                  disabled={pending}
                />
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Имя"
                  autoComplete="given-name"
                  disabled={pending}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-primary" disabled={pending || !firstName.trim() || !lastName.trim()}>
                  {pending ? "Сохраняем…" : "Сохранить"}
                </button>
                {hasRealName ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={pending}
                    onClick={() => {
                      setFirstName(initialFirstName);
                      setLastName(initialLastName);
                      setEditing(false);
                      setOk("");
                      setError("");
                    }}
                  >
                    Отмена
                  </button>
                ) : null}
              </div>
              {ok ? <p className="text-sm text-accent">{ok}</p> : null}
              {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
