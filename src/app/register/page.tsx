"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AuthScreenShell } from "@/components/AuthScreenShell";
import { isAccessDeniedResponse } from "@/lib/accessDenied";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setError("Укажите имя и фамилию (минимум 2 символа каждое)");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    start(async () => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            phone,
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            telegramUsername: telegramUsername.trim()
          })
        });
        const data = (await res.json()) as {
          error?: string;
          onboardingRequired?: boolean;
          pendingApproval?: boolean;
        };

        if (isAccessDeniedResponse(res.status, data)) {
          window.location.replace("/access-denied");
          return;
        }

        if (!res.ok) {
          setError(data.error ?? "Не удалось зарегистрироваться");
          return;
        }

        if (data.pendingApproval) {
          window.location.replace("/pending-approval");
          return;
        }
        window.location.replace(data.onboardingRequired ? "/welcome" : "/schedule");
      } catch {
        setError("Ошибка сети. Попробуйте снова.");
      }
    });
  }

  return (
    <AuthScreenShell title="Регистрация" description="Создайте аккаунт по номеру телефона">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Имя"
            autoComplete="given-name"
            required
            minLength={2}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Фамилия"
            autoComplete="family-name"
            required
            minLength={2}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон +7..."
            autoComplete="tel"
            inputMode="tel"
            required
          />
          <input
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
            placeholder="Telegram @username (необязательно)"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль (мин. 8 символов)"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Повторите пароль"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <button className="btn-primary w-full rounded-xl py-3 text-sm font-bold" disabled={pending} type="submit">
          {pending ? "Регистрируем…" : "Зарегистрироваться"}
        </button>
        {error ? <p className="text-center text-sm font-medium text-foreground/85">{error}</p> : null}
        <p className="text-center text-sm text-muted">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="link-tech">
            Войти
          </Link>
        </p>
      </form>
    </AuthScreenShell>
  );
}
