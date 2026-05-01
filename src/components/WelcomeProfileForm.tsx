"use client";

import { useState, useTransition } from "react";
import { completeWelcomeProfile } from "@/app/actions";

export function WelcomeProfileForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(51,144,236,0.20),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(51,144,236,0.10),transparent_35%)]" />
      <form
        className="relative w-full max-w-md space-y-4 rounded-2xl border border-border bg-card/90 p-5 shadow-[0_22px_55px_rgba(0,0,0,0.45)] backdrop-blur"
        action={() =>
          start(async () => {
            setError("");
            try {
              await completeWelcomeProfile({ firstName, lastName });
              window.location.href = "/schedule";
            } catch (e) {
              setError(e instanceof Error ? e.message : "Ошибка сохранения");
            }
          })
        }
      >
        <div className="space-y-2 text-center">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-accent/10 blur-2xl" />
            <img src="/api/brand-logo" alt="Logo" className="relative h-24 w-24 object-contain animate-logo-spin" />
          </div>
          <h1 className="text-3xl font-bold">Привет)</h1>
        </div>

        <div className="grid gap-2">
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" autoComplete="family-name" />
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" autoComplete="given-name" />
        </div>

        <button className="btn-primary w-full rounded-xl py-3 text-sm font-bold" disabled={pending || !firstName.trim() || !lastName.trim()}>
          {pending ? "Сохраняем профиль..." : "Продолжить"}
        </button>

        {pending ? (
          <div className="flex items-center justify-center gap-1 py-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
          </div>
        ) : null}
        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
      </form>
    </div>
  );
}
