"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import { AuthScreenShell } from "@/components/AuthScreenShell";
import { TelegramBotLinkAuth } from "@/components/TelegramBotLinkAuth";
import { TelegramDevBypassLogin } from "@/components/TelegramDevBypassLogin";
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

const SHOW_DEV_LOGIN = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_DEV === "true";

export default function TelegramLoginPage() {
  const [loading, setLoading] = useState(true);
  const [showBrowserFallback, setShowBrowserFallback] = useState(false);
  const [error, setError] = useState("");
  const navigateAfterLogin = useCallback((onboardingRequired: boolean) => {
    window.location.href = onboardingRequired ? "/welcome" : "/schedule";
  }, []);

  useEffect(() => {
    const loginMiniApp = async () => {
      try {
        const app = window.Telegram?.WebApp;
        if (!app?.initData) {
          setShowBrowserFallback(true);
          setLoading(false);
          return;
        }

        app.ready();
        app.expand();

        const res = await fetch("/api/telegram/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: app.initData })
        });
        const data = (await res.json()) as AccessDeniedPayload & { onboardingRequired?: boolean };
        if (isAccessDeniedResponse(res.status, data)) {
          window.location.replace("/access-denied");
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Авторизация через Telegram не удалась");
        navigateAfterLogin(Boolean(data.onboardingRequired));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка авторизации");
        setShowBrowserFallback(true);
      } finally {
        setLoading(false);
      }
    };
    loginMiniApp();
  }, [navigateAfterLogin]);

  const subtitle = loading ? (
    "Подключение к Telegram Mini App… если вы в браузере, ниже появится вход через бота."
  ) : showBrowserFallback && error ? (
    "Не получилось войти через Mini App — воспользуйтесь браузерным способом ниже."
  ) : null;

  return (
    <>
      {/*
       * beforeInteractive поддерживается в основном из корневого layout (Server Component).
       * В клиентской странице на части сборок/next dev это давало Internal Server Error.
       */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <AuthScreenShell title="Авторизация через Telegram" description={subtitle || undefined}>
        {SHOW_DEV_LOGIN ? (
          <div className="mb-6">
            <TelegramDevBypassLogin />
          </div>
        ) : null}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
            </div>
            <p className="text-xs text-muted">Проверяем аккаунт…</p>
          </div>
        ) : null}

        {!loading && showBrowserFallback ? (
          <div className="space-y-4" data-no-swipe="true">
            {error ? <p className="text-center text-sm font-medium text-foreground/85">{error}</p> : null}
            <TelegramBotLinkAuth />
          </div>
        ) : null}
      </AuthScreenShell>
    </>
  );
}
