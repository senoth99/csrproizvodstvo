"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { AuthScreenShell } from "@/components/AuthScreenShell";
import { TelegramBrowserLogin } from "@/components/TelegramBrowserLogin";
import type { AccessDeniedPayload } from "@/lib/accessDenied";
import { isAccessDeniedResponse } from "@/lib/accessDenied";

const POLL_MS = 50;
/** После загрузки SDK: ~4 с на появление initData в WebView. */
const POLL_MAX = 80;

const BUILD_REF = process.env.NEXT_PUBLIC_BUILD_REF?.trim();
const SHOW_DEV_LOGIN =
  process.env.NEXT_PUBLIC_TELEGRAM_AUTH_DEV === "true" && process.env.NODE_ENV !== "production";

type LoginMode = "detecting" | "mini_app" | "browser" | "error";

export default function TelegramLoginPage() {
  const [mode, setMode] = useState<LoginMode>("detecting");
  const [error, setError] = useState("");
  const [webAppScriptReady, setWebAppScriptReady] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      setWebAppScriptReady((ready) => ready || true);
    }, 8000);
    return () => window.clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (!webAppScriptReady) return;
    let cancelled = false;

    (async () => {
      for (let i = 0; i < POLL_MAX && !cancelled; i++) {
        const WebApp = window.Telegram?.WebApp;
        const initData = WebApp?.initData?.trim();
        if (WebApp && initData) {
          if (doneRef.current) return;
          doneRef.current = true;
          setMode("mini_app");
          try {
            WebApp.ready();
            WebApp.expand();
            const res = await fetch("/api/telegram/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ initData })
            });
            const data = (await res.json()) as AccessDeniedPayload & {
              error?: string;
              onboardingRequired?: boolean;
            };
            if (isAccessDeniedResponse(res.status, data)) {
              window.location.replace("/access-denied");
              return;
            }
            if (!res.ok) throw new Error(data.error ?? "Авторизация не удалась");
            const onboarding = Boolean(data.onboardingRequired);
            window.location.replace(onboarding ? "/welcome" : "/schedule");
            return;
          } catch (e) {
            doneRef.current = false;
            setError(e instanceof Error ? e.message : "Ошибка авторизации");
            setMode("error");
            return;
          }
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      if (!cancelled && !doneRef.current) {
        setMode("browser");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [webAppScriptReady]);

  const title =
    mode === "detecting" || mode === "mini_app"
      ? "Вход"
      : mode === "browser"
        ? "Вход через Telegram"
        : "Вход";

  const description =
    mode === "detecting" || mode === "mini_app"
      ? "Подключение к Telegram…"
      : mode === "browser"
        ? "Откройте бота в Telegram — мы подтвердим вход в этом браузере."
        : mode === "error"
          ? "Не удалось войти."
          : undefined;

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => setWebAppScriptReady(true)}
      />
      <AuthScreenShell title={title} description={description}>
        {mode === "detecting" || mode === "mini_app" ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
            </div>
            <p className="text-xs text-muted">Входим по вашему аккаунту Telegram…</p>
          </div>
        ) : null}

        {mode === "browser" ? <TelegramBrowserLogin showDevLogin={SHOW_DEV_LOGIN} /> : null}

        {mode === "error" && error ? (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-foreground/85">{error}</p>
            <TelegramBrowserLogin showDevLogin={SHOW_DEV_LOGIN} />
          </div>
        ) : null}

        {BUILD_REF ? (
          <p className="pt-2 text-center font-mono text-[10px] leading-tight text-muted/45" title="Метка сборки на сервере">
            build {BUILD_REF}
          </p>
        ) : null}
      </AuthScreenShell>
    </>
  );
}
