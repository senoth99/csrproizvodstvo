"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { AuthScreenShell } from "@/components/AuthScreenShell";
import { TelegramBrowserLogin } from "@/components/TelegramBrowserLogin";
import type { AccessDeniedPayload } from "@/lib/accessDenied";
import { isAccessDeniedResponse } from "@/lib/accessDenied";
import { isLikelyTelegramMiniAppHost } from "@/lib/telegramClientDetect";

const POLL_MS = 50;
/** После загрузки SDK: ~4 с на появление initData в WebView. */
const POLL_MAX = 80;

const BUILD_REF = process.env.NEXT_PUBLIC_BUILD_REF?.trim();
const SHOW_DEV_LOGIN = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_DEV === "true";

const FINISH_ERROR_MESSAGES: Record<string, string> = {
  not_ready: "Вход ещё не подтверждён в боте. Нажмите Start в Telegram и снова «Проверить вход».",
  expired: "Код входа устарел. Нажмите «Начать заново».",
  bad_token: "Неверная ссылка входа. Начните вход заново.",
  invalid_user: "Не удалось определить аккаунт Telegram. Попробуйте снова.",
  session: "Не удалось создать сессию. Сообщите администратору.",
  server: "Ошибка сервера. Попробуйте через минуту."
};

type LoginMode = "detecting" | "mini_app" | "browser" | "error";

export default function TelegramLoginPage() {
  const [mode, setMode] = useState<LoginMode>(() =>
    typeof window !== "undefined" && !isLikelyTelegramMiniAppHost() ? "browser" : "detecting"
  );
  const [error, setError] = useState("");
  const [webAppScriptReady, setWebAppScriptReady] = useState(false);
  const [isMiniAppHost, setIsMiniAppHost] = useState(() =>
    typeof window !== "undefined" ? isLikelyTelegramMiniAppHost() : true
  );
  const doneRef = useRef(false);

  useEffect(() => {
    const tg = isLikelyTelegramMiniAppHost();
    setIsMiniAppHost(tg);
    if (!tg) setMode("browser");
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && FINISH_ERROR_MESSAGES[code]) {
      setError(FINISH_ERROR_MESSAGES[code]);
      setMode("error");
    }
  }, []);

  useEffect(() => {
    if (!isMiniAppHost) return;
    const fallback = window.setTimeout(() => {
      setWebAppScriptReady((ready) => ready || true);
    }, 8000);
    return () => window.clearTimeout(fallback);
  }, [isMiniAppHost]);

  useEffect(() => {
    if (!isMiniAppHost || !webAppScriptReady) return;
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
            let lastError: Error | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
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
                lastError = e instanceof Error ? e : new Error("Ошибка авторизации");
                if (attempt < 2) {
                  await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
                }
              }
            }
            throw lastError ?? new Error("Ошибка авторизации");
          } catch (e) {
            doneRef.current = false;
            setError(e instanceof Error ? e.message : "Ошибка авторизации");
            setMode("error");
            return;
          }
        }
        if (WebApp && !initData) {
          if (!cancelled && !doneRef.current) setMode("browser");
          return;
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
  }, [isMiniAppHost, webAppScriptReady]);

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
      {isMiniAppHost ? (
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="afterInteractive"
          onReady={() => setWebAppScriptReady(true)}
        />
      ) : null}
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

        {mode === "error" ? (
          <div className="space-y-3">
            {error ? <p className="text-center text-sm font-medium text-foreground/85">{error}</p> : null}
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
