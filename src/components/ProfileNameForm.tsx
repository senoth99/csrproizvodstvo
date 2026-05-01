"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateMyProfile } from "@/app/actions";

export function ProfileNameForm({
  initialFirstName,
  initialLastName
}: {
  initialFirstName: string;
  initialLastName: string;
}) {
  const hasRealName = Boolean(initialFirstName.trim() && initialLastName.trim());
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [editing, setEditing] = useState(!hasRealName);
  const [pending, start] = useTransition();

  if (!editing && hasRealName) {
    return (
      <div className="card flex items-center justify-between gap-2 py-3">
        <div>
          <p className="text-xs text-muted">Реальное имя</p>
          <p className="text-sm font-semibold">
            {initialLastName} {initialFirstName}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:text-foreground"
          aria-label="Редактировать имя"
          onClick={() => {
            setOk("");
            setError("");
            setEditing(true);
          }}
        >
          <Pencil size={14} />
        </button>
      </div>
    );
  }

  return (
    <form
      className="card space-y-3"
      action={() =>
        start(async () => {
          setError("");
          setOk("");
          try {
            await updateMyProfile({ firstName, lastName });
            setOk("Профиль обновлен");
            setEditing(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось сохранить");
          }
        })
      }
    >
      <h3 className="font-semibold">Реальное имя</h3>
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Фамилия"
          autoComplete="family-name"
        />
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Имя"
          autoComplete="given-name"
        />
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={pending || !firstName.trim() || !lastName.trim()}>
          {pending ? "Сохраняем..." : "Сохранить"}
        </button>
        {hasRealName ? (
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
            Отмена
          </button>
        ) : null}
      </div>
      {ok && <p className="text-sm text-accent">{ok}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
