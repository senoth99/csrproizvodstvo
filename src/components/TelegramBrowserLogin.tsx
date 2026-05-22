"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAccessDeniedResponse, type AccessDeniedPayload } from "@/lib/accessDenied";

const POLL_MS = 800;
const STORAGE_KEY = "ps_tg_browser_login_v1";

type StoredChallenge = {
  token: string;
  openUrl: string;
  expiresAt: number;
};

type StartPayload = {
  token?: string;
  openUrl?: string | null;
  expiresInSec?: number;
  error?: string;
  botUsername?: string | null;
  devModeNoBot?: boolean;
};

type CompletePayload = AccessDeniedPayload & {
  ok?: boolean;
  waiting?: boolean;
  onboardingRequired?: boolean;
  error?: string;
};

function readStored(): StoredChallenge | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChallenge;
    if (!parsed.token || !parsed.openUrl || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(data: StoredChallenge) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearStored() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function TelegramBrowserLogin({
  showDevLogin = false
}: {
  showDevLogin?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "error">("idle");
  const [error, setError] = useState("");
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const pollingRef = useRef(false);
  const startingRef = useRef(false);

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
        clearStored();
        window.location.replace("/access-denied");
        return true;
      }
      if (res.status === 202 || data.waiting) return false;
      if (!res.ok) {
        stopPolling();
        setPhase("error");
        if (res.status === 410) {
          clearStored();
          setError("Код входа устарел. Нажмите «Начать заново».");
        } else {
          setError(data.error ?? "Не удалось завершить вход");
        }
        return true;
      }
      if (!data.ok) return false;

      stopPolling();
      clearStored();
      window.location.replace(data.onboardingRequired ? "/welcome" : "/schedule");
      return true;
    },
    [stopPolling]
  );

  const pollOnce = useCallback(async () => {
    const token = tokenRef.current;
    if (!token || !pollingRef.current) return;
    await completeLogin(token);
  }, [completeLogin]);

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

  const beginBrowserLogin = useCallback(
    async (forceNew = false) => {
      if (startingRef.current) return;
      startingRef.current = true;
      setError("");
      stopPolling();

      try {
        if (!forceNew) {
          const stored = readStored();
          if (stored) {
            tokenRef.current = stored.token;
            setOpenUrl(stored.openUrl);
            startPolling(stored.token);
            return;
          }
        } else {
          clearStored();
        }

        const res = await fetch("/api/telegram/browser-auth/start", { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as StartPayload;
        if (!res.ok) {
          setPhase("error");
          setError(data.error ?? "Не удалось начать вход");
          return;
        }
        if (!data.token || !data.openUrl) {
          setPhase("error");
          setError(
            data.devModeNoBot
              ? "Бот не настроен на сервере (TELEGRAM_BOT_TOKEN / NEXT_PUBLIC_TELEGRAM_BOT_USERNAME)."
              : "Сервер не выдал ссылку на бота"
          );
          return;
        }

        const expiresAt = Date.now() + (data.expiresInSec ?? 900) * 1000;
        writeStored({ token: data.token, openUrl: data.openUrl, expiresAt });
        tokenRef.current = data.token;
        setOpenUrl(data.openUrl);
        startPolling(data.token);
      } catch (e) {
        setPhase("error");
        setError(e instanceof Error ? e.message : "Ошибка сети");
      } finally {
        startingRef.current = false;
      }
    },
    [startPolling, stopPolling]
  );

  useEffect(() => {
    void beginBrowserLogin(false);
    return () => stopPolling();
  }, [beginBrowserLogin, stopPolling]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && pollingRef.current) {
        void pollOnce();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [pollOnce]);

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
      clearStored();
      window.location.replace(data.onboardingRequired ? "/welcome" : "/schedule");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Ошибка dev-входа");
    }
  };

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
        <li>
          Нажмите <strong className="text-foreground">«Открыть бота»</strong> ниже (важно — ссылка с сайта, не просто чат
          бота).
        </li>
        <li>В Telegram нажмите <strong className="text-foreground">Запустить / Start</strong>.</li>
        <li>Дождитесь ответа бота «Готово…».</li>
        <li>Вернитесь в <strong className="text-foreground">эту вкладку</strong> браузера.</li>
      </ol>

      {openUrl ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex min-h-[48px] w-full items-center justify-center touch-manipulation text-center"
        >
          Открыть бота в Telegram
        </a>
      ) : null}

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
        <button type="button" className="btn-secondary w-full" onClick={() => void pollOnce()}>
          Я нажал Start — проверить вход
        </button>
        <button type="button" className="btn-secondary w-full" onClick={() => void beginBrowserLogin(true)}>
          Начать заново
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
