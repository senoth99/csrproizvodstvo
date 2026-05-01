"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { Send } from "lucide-react";

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

export default function TelegramLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const login = async () => {
      try {
        const app = window.Telegram?.WebApp;
        if (!app?.initData) {
          setError("Откройте приложение из Telegram Mini App.");
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
        const data = (await res.json()) as { onboardingRequired?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Авторизация через Telegram не удалась");
        window.location.href = data.onboardingRequired ? "/welcome" : "/schedule";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка авторизации");
      } finally {
        setLoading(false);
      }
    };
    login();
  }, []);

  return (
    <div className="card mx-auto mt-20 max-w-md space-y-3 text-center">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Send size={18} />
      </div>
      <h1 className="text-xl font-semibold">Вход через Telegram</h1>
      <p className="text-sm text-muted">{loading ? "Проверяем аккаунт..." : "Выполняется вход в Mini App"}</p>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
