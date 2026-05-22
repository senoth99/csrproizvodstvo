"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAccessDeniedResponse, type AccessDeniedPayload } from "@/lib/accessDenied";

const POLL_MS = 1500;

type StartPayload = {
  token?: string;
  openUrl?: string | null;
  error?: string;
  devModeNoBot?: boolean;
};

type CompletePayload = AccessDeniedPayload & {
  ok?: boolean;
  waiting?: boolean;
  onboardingRequired?: boolean;
  error?: string;
};

export function TelegramBrowserLogin({
  showDevLogin = false
}: {
  showDevLogin?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "error">("idle");
  const [error, setError] = useState("");
  const tokenRef = useRef<string | null>(null);
  const pollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
  }, []);

  const completeLogin = useCallback(
    async (token: string) => {
      const res = await fetch("/api/telegram/browser-auth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token })
      });
      const data = (await res.json().catch(() => ({}))) as CompletePayload;

      if (isAccessDeniedResponse(res.status, data)) {
        stopPolling();
        window.location.replace("/access-denied");
        return true;
      }
      if (res.status === 202 || data.waiting) return false;
      if (!res.ok) {
        stopPolling();
        setPhase("error");
        setError(data.error ?? "Не удалось завершить вход");
        return true;
      }
      if (!data.ok) return false;

      stopPolling();
      window.location.replace(data.onboardingRequired ? "/welcome" : "/schedule");
      return true;
    },
    [stopPolling]
  );

  const startPolling = useCallback(
    (token: string) => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      setPhase("waiting");

      const tick = async () => {
        if (!pollingRef.current) return;
        const done = await completeLogin(token);
        if (done) return;
        window.setTimeout(tick, POLL_MS);
      };
      void tick();
    },
    [completeLogin]
  );

  const beginBrowserLogin = useCallback(async () => {
    setError("");
    setPhase("idle");
    stopPolling();

    try {
      const res = await fetch("/api/telegram/browser-auth/start", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as StartPayload;
      if (!res.ok) {
        setPhase("error");
        setError(data.error ?? "Не удалось начать вход");
        return;
      }
      if (!data.token) {
        setPhase("error");
        setError("Сервер не выдал код входа");
        return;
      }
      tokenRef.current = data.token;
      if (data.openUrl) {
        window.open(data.openUrl, "_blank", "noopener,noreferrer");
      }
      startPolling(data.token);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Ошибка сети");
    }
  }, [startPolling, stopPolling]);

  useEffect(() => {
    void beginBrowserLogin();
    return () => stopPolling();
  }, [beginBrowserLogin, stopPolling]);

  const devLogin = async () => {
    setError("");
    try {
      const res = await fetch("/api/telegram/browser-auth/dev-session", {
        method: "POST",
        credentials: "include"
      });
      const data = (await res.json().catch(() => ({}))) as CompletePayload;
      if (isAccessDeniedResponse(res.status, data)) {
        window.location.replace("/access-denied");
        return;
      }
      if (!res.ok) {
        setPhase("error");
        setError(data.error ?? "Dev-вход недоступен");
        return;
      }
      window.location.replace(data.onboardingRequired ? "/welcome" : "/schedule");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Ошибка dev-входа");
    }
  };

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
        <li>Откроется Telegram с ботом — нажмите «Запустить» / Start.</li>
        <li>Дождитесь ответа бота «Готово…».</li>
        <li>Вернитесь в эту вкладку браузера — вход продолжится сам.</li>
      </ol>

      {phase === "waiting" ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
          </div>
          <p className="text-center text-xs text-muted">Ждём подтверждение в Telegram…</p>
        </div>
      ) : null}

      {error ? <p className="text-center text-sm font-medium text-foreground/85">{error}</p> : null}

      <div className="grid gap-2">
        <button type="button" className="btn-primary w-full" onClick={() => void beginBrowserLogin()}>
          {phase === "waiting" ? "Открыть Telegram снова" : "Повторить вход"}
        </button>
        {showDevLogin ? (
          <button type="button" className="btn-secondary w-full" onClick={() => void devLogin()}>
            Войти как тестовый пользователь (dev)
          </button>
        ) : null}
      </div>
    </div>
  );
}
