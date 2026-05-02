"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { AuthScreenShell } from "@/components/AuthScreenShell";
import type { AccessDeniedPayload } from "@/lib/accessDenied";
import { isAccessDeniedResponse } from "@/lib/accessDenied";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData: string;
      };
    };
  }
}

const POLL_MS = 50;
const POLL_MAX = 80;

export default function TelegramLoginPage() {
  const [phase, setPhase] = useState<"loading" | "outside" | "error">("loading");
  const [error, setError] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (let i = 0; i < POLL_MAX && !cancelled; i++) {
        const WebApp = window.Telegram?.WebApp;
        const initData = WebApp?.initData?.trim();
        if (WebApp && initData) {
          if (doneRef.current) return;
          doneRef.current = true;
          try {
            WebApp.ready();
            WebApp.expand();
            const res = await fetch("/api/telegram/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ initData })
            });
            const data = (await res.json()) as AccessDeniedPayload & { error?: string };
            if (isAccessDeniedResponse(res.status, data)) {
              window.location.replace("/access-denied");
              return;
            }
            if (!res.ok) throw new Error(data.error ?? "Авторизация не удалась");
            const onboarding = Boolean((data as { onboardingRequired?: boolean }).onboardingRequired);
            window.location.replace(onboarding ? "/welcome" : "/schedule");
            return;
          } catch (e) {
            doneRef.current = false;
            setError(e instanceof Error ? e.message : "Ошибка авторизации");
            setPhase("error");
            return;
          }
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      if (!cancelled && !doneRef.current) {
        setPhase("outside");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <AuthScreenShell
        title="Вход"
        description={
          phase === "loading"
            ? "Подключение к Telegram…"
            : phase === "outside"
              ? "Этот вход доступен только из Telegram Mini App. Откройте бота и запустите приложение из меню или с кнопки под строкой ввода."
              : phase === "error"
                ? "Не удалось войти. Закройте Mini App и откройте снова из Telegram."
                : undefined
        }
      >
        {phase === "loading" ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
            </div>
            <p className="text-xs text-muted">Входим по вашему аккаунту Telegram…</p>
          </div>
        ) : null}

        {phase === "error" && error ? (
          <p className="text-center text-sm font-medium text-foreground/85">{error}</p>
        ) : null}
      </AuthScreenShell>
    </>
  );
}
