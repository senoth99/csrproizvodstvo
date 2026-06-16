"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AuthScreenShell } from "@/components/AuthScreenShell";
import { isAccessDeniedResponse } from "@/lib/accessDenied";

type Mode = "login" | "set-password";

const FINISH_ERROR_MESSAGES: Record<string, string> = {
  not_ready: "Вход ещё не подтверждён в боте. Нажмите Start в Telegram и снова «Проверить вход».",
  expired: "Код входа устарел. Нажмите «Начать заново».",
  bad_token: "Неверная ссылка входа. Начните вход заново.",
  invalid_user: "Не удалось определить аккаунт Telegram. Попробуйте снова.",
  session: "Не удалось создать сессию. Сообщите администратору.",
  server: "Ошибка сервера. Попробуйте через минуту."
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && FINISH_ERROR_MESSAGES[code]) {
      setError(FINISH_ERROR_MESSAGES[code]);
    }
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone, password })
        });
        const data = (await res.json()) as {
          error?: string;
          needsPassword?: boolean;
          onboardingRequired?: boolean;
          pendingApproval?: boolean;
        };

        if (isAccessDeniedResponse(res.status, data)) {
          window.location.replace("/access-denied");
          return;
        }

        if (data.needsPassword) {
          setMode("set-password");
          setPassword("");
          setConfirmPassword("");
          return;
        }

        if (!res.ok) {
          setError(data.error ?? "Не удалось войти");
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

  function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    start(async () => {
      try {
        const res = await fetch("/api/auth/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone, password })
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
          setError(data.error ?? "Не удалось задать пароль");
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
    <AuthScreenShell
      title={mode === "login" ? "Вход" : "Задайте пароль"}
      description={
        mode === "set-password"
          ? "Для вашего аккаунта ещё не задан пароль. Придумайте пароль для входа."
          : "Войдите по номеру телефона и паролю"
      }
    >
      {mode === "login" ? (
        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="grid gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Телефон +7..."
              autoComplete="tel"
              inputMode="tel"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn-primary w-full rounded-xl py-3 text-sm font-bold" disabled={pending} type="submit">
            {pending ? "Входим…" : "Войти"}
          </button>
          {error ? <p className="text-center text-sm font-medium text-foreground/85">{error}</p> : null}
          <p className="text-center text-sm text-muted">
            Нет аккаунта?{" "}
            <Link href="/register" className="link-tech">
              Зарегистрироваться
            </Link>
          </p>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSetPassword}>
          <div className="grid gap-2">
            <input value={phone} readOnly className="opacity-70" aria-label="Телефон" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Новый пароль (мин. 8 символов)"
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
            {pending ? "Сохраняем…" : "Задать пароль и войти"}
          </button>
          {error ? <p className="text-center text-sm font-medium text-foreground/85">{error}</p> : null}
          <button
            type="button"
            className="w-full text-sm text-muted underline-offset-2 hover:underline"
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Назад ко входу
          </button>
        </form>
      )}
    </AuthScreenShell>
  );
}
