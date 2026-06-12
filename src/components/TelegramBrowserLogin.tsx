"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAccessDeniedResponse, type AccessDeniedPayload } from "@/lib/accessDenied";

const POLL_MS = 800;
const STORAGE_KEY = "ps_tg_browser_login_v1";

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function readStorageRaw(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

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
  ready?: boolean;
  finishUrl?: string;
  waiting?: boolean;
  onboardingRequired?: boolean;
  error?: string;
};

function readStored(): StoredChallenge | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readStorageRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChallenge;
    if (!parsed.token || !parsed.openUrl || parsed.expiresAt < Date.now()) {
      clearStored();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(data: StoredChallenge) {
  const json = JSON.stringify(data);
  try {
    sessionStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
}

function clearStored() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
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
  const completingRef = useRef(false);
  const resumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
  }, []);

  const completeLogin = useCallback(
    async (token: string) => {
      if (completingRef.current) return false;
      completingRef.current = true;
      try {
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
          } else if (res.status === 403) {
            clearStored();
            window.location.replace("/access-denied");
          } else {
            setError(data.error ?? "Не удалось завершить вход");
          }
          return true;
        }

        if (data.ready && data.finishUrl) {
          stopPolling();
          clearStored();
          // Полный переход — Safari надёжно сохраняет httpOnly cookie (fetch часто нет).
          window.location.href = data.finishUrl;
          return true;
        }

        if (!data.ok) return false;

        stopPolling();
        clearStored();
        window.location.replace(data.onboardingRequired ? "/welcome" : "/schedule");
        return true;
      } finally {
        completingRef.current = false;
      }
    },
    [stopPolling]
  );

  const pollOnce = useCallback(async () => {
    const token = tokenRef.current ?? readStored()?.token ?? null;
    if (!token) return;
    tokenRef.current = token;
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

  const resumePollingFromStorage = useCallback(() => {
    if (resumeDebounceRef.current) clearTimeout(resumeDebounceRef.current);
    resumeDebounceRef.current = setTimeout(() => {
      resumeDebounceRef.current = null;
      const stored = readStored();
      if (!stored) return;
      tokenRef.current = stored.token;
      setOpenUrl(stored.openUrl);
      if (!pollingRef.current) {
        startPolling(stored.token);
      } else {
        void pollOnce();
      }
    }, 200);
  }, [pollOnce, startPolling]);

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
      if (document.visibilityState !== "visible") return;
      resumePollingFromStorage();
    };
    const onPageShow = () => {
      resumePollingFromStorage();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [resumePollingFromStorage]);

  const openTelegramBot = useCallback(() => {
    if (!openUrl) return;
    if (isMobileBrowser()) {
      window.location.assign(openUrl);
      return;
    }
    window.open(openUrl, "_blank", "noopener,noreferrer");
  }, [openUrl]);

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
          Нажмите <strong className="text-foreground">«Открыть бота»</strong> ниже — обязательно эту кнопку, не ищите бота
          вручную в Telegram.
        </li>
        <li>В Telegram нажмите <strong className="text-foreground">Запустить / Start</strong>.</li>
        <li>Дождитесь ответа бота «Готово…».</li>
        <li>
          Вернитесь в <strong className="text-foreground">Safari или Chrome</strong> на вкладку с этой страницей (на
          телефоне — переключатель приложений, не новый поиск сайта).
        </li>
      </ol>

      {openUrl ? (
        <button
          type="button"
          onClick={openTelegramBot}
          className="btn-primary flex min-h-[48px] w-full items-center justify-center touch-manipulation text-center"
        >
          Открыть бота в Telegram
        </button>
      ) : null}

      {isMobileBrowser() && phase === "waiting" ? (
        <p className="text-center text-xs text-muted">
          После «Готово» в боте откройте браузер снова и нажмите «Проверить вход», если страница не обновилась сама.
        </p>
      ) : null}

      {phase === "waiting" ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
          </div>
          <p className="text-center text-xs text-muted">
            Ждём ответ бота «Готово» в Telegram… Если бот пишет «Доступ не выдан» — обратитесь к администратору.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-center text-sm font-medium text-foreground/85">{error}</p> : null}

      <div className="grid gap-2">
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => resumePollingFromStorage()}
        >
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
