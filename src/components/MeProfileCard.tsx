"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { AvatarUploadControl } from "@/components/AvatarUploadControl";
import { updateMyProfile } from "@/app/actions";
import { formatPhoneDisplay } from "@/lib/formatPhone";

export function MeProfileCard({
  displayName,
  telegramUsername,
  photoUrl,
  hasCustomAvatar,
  accentColor,
  initialFirstName,
  initialLastName,
  initialPhone
}: {
  displayName: string;
  telegramUsername: string;
  photoUrl: string | null;
  hasCustomAvatar: boolean;
  accentColor: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
}) {
  const router = useRouter();
  const hasCompleteProfile = Boolean(
    initialFirstName.trim() && initialLastName.trim() && initialPhone.trim()
  );
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [editing, setEditing] = useState(!hasCompleteProfile);
  const [pending, start] = useTransition();

  return (
    <div className="mt-1 bg-background px-4 pt-2.5 pb-3">
      <div className="flex items-start gap-2.5">
        <AvatarUploadControl
          name={displayName}
          photoUrl={photoUrl}
          accentColor={accentColor}
          hasCustomAvatar={hasCustomAvatar}
          onChanged={() => router.refresh()}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-xl font-bold uppercase leading-none tracking-display">
                {displayName}
              </h1>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted leading-none">
                @{telegramUsername}
              </p>
              {!editing && initialPhone.trim() ? (
                <p className="mt-2 text-sm tabular-nums text-foreground/90">{formatPhoneDisplay(initialPhone)}</p>
              ) : null}
            </div>
            {hasCompleteProfile ? (
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-border bg-transparent text-muted transition hover:bg-foreground/[0.07] hover:text-foreground"
                aria-label={editing ? "Закрыть редактирование профиля" : "Изменить профиль"}
                aria-expanded={editing}
                disabled={pending}
                onClick={() => {
                  if (editing) {
                    setFirstName(initialFirstName);
                    setLastName(initialLastName);
                    setPhone(initialPhone);
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

          {ok ? <p className="mt-3 text-sm text-accent">{ok}</p> : null}

          {editing ? (
            <form
              className="mt-4 space-y-3 border-t border-border pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                setOk("");
                start(async () => {
                  try {
                    await updateMyProfile({ firstName, lastName, phone });
                    setOk("Сохранено");
                    setEditing(false);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Не удалось сохранить");
                  }
                });
              }}
            >
              <p className="text-xs font-medium text-muted">Как в паспорте и контактный телефон</p>
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
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон +7..."
                autoComplete="tel"
                inputMode="tel"
                disabled={pending}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="btn-primary"
                  disabled={pending || !firstName.trim() || !lastName.trim() || !phone.trim()}
                >
                  {pending ? "Сохраняем…" : "Сохранить"}
                </button>
                {hasCompleteProfile ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={pending}
                    onClick={() => {
                      setFirstName(initialFirstName);
                      setLastName(initialLastName);
                      setPhone(initialPhone);
                      setEditing(false);
                      setOk("");
                      setError("");
                    }}
                  >
                    Отмена
                  </button>
                ) : null}
              </div>
              {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
