"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";

/** Кнопка «вход без бота» — рендерить только когда NEXT_PUBLIC_TELEGRAM_AUTH_DEV=true (см. страницу входа). */
export function TelegramDevBypassLogin() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/telegram/browser-auth/dev-session", {
        method: "POST",
        credentials: "same-origin"
      });

      const raw = await res.text().catch(() => "");
      let onboardingRequired = false;
      try {
        const data = JSON.parse(raw) as { onboardingRequired?: boolean; error?: string; hint?: string };
        if (!res.ok) {
          const extra = data.hint ? ` ${data.hint}` : "";
          setMsg((data.error ?? `HTTP ${res.status}`) + extra);
          return;
        }
        onboardingRequired = Boolean(data.onboardingRequired);
      } catch {
        const preview = raw.replace(/\s+/g, " ").trim().slice(0, 180);
        setMsg(
          preview
            ? `Ответ без JSON (${res.status}): ${preview}`
            : `Нет тела ответа (${res.status}). Смотри терминал next dev после POST /api/telegram/browser-auth/dev-session.`
        );
        return;
      }

      window.location.href = onboardingRequired ? "/welcome" : "/schedule";
    } catch {
      setMsg("Сеть или сервер недоступны.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-muted/30 bg-muted/[0.05] px-4 py-3 text-left">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
        <FlaskConical className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        Разработка: без Telegram-бота
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-muted">
        Сервер должен быть в <span className="font-mono text-foreground/80">NODE_ENV=development</span>, в{" "}
        <span className="font-mono text-foreground/80">.env</span>:{" "}
        <span className="font-mono text-[11px] text-foreground/80">TELEGRAM_ALLOW_DEV_LOGIN=true</span>.
      </p>
      <button
        type="button"
        disabled={busy}
        className="btn-secondary w-full py-3 text-[13px] disabled:opacity-60"
        onClick={() => void run()}
        data-no-swipe="true"
      >
        {busy ? "Входим…" : "Войти как тестовый пользователь"}
      </button>
      {msg ? <p className="mt-2 text-center text-xs font-medium text-foreground/85">{msg}</p> : null}
    </div>
  );
}
