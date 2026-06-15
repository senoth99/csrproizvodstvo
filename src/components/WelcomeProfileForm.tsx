"use client";

import { useState, useTransition } from "react";
import { completeWelcomeProfile } from "@/app/actions";
import { AuthScreenShell } from "@/components/AuthScreenShell";

export function WelcomeProfileForm({
  initialFirstName = "",
  initialLastName = "",
  initialPhone = ""
}: {
  initialFirstName?: string;
  initialLastName?: string;
  initialPhone?: string;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <AuthScreenShell title="Привет)">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            try {
              await completeWelcomeProfile({ firstName, lastName, phone });
              window.location.href = "/schedule";
            } catch (err) {
              setError(err instanceof Error ? err.message : "Ошибка сохранения");
            }
          });
        }}
      >
        <div className="grid gap-2">
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" autoComplete="family-name" />
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" autoComplete="given-name" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон +7..."
            autoComplete="tel"
            inputMode="tel"
          />
        </div>

        <button
          className="btn-primary w-full rounded-xl py-3 text-sm font-bold"
          disabled={pending || !firstName.trim() || !lastName.trim() || !phone.trim()}
        >
          {pending ? "Сохраняем профиль..." : "Продолжить"}
        </button>

        {pending ? (
          <div className="flex items-center justify-center gap-1 py-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
          </div>
        ) : null}
        {error ? <p className="text-center text-sm font-medium text-foreground/85">{error}</p> : null}
      </form>
    </AuthScreenShell>
  );
}
