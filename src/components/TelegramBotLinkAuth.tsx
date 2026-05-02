"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessDeniedPayload } from "@/lib/accessDenied";
import { isAccessDeniedResponse } from "@/lib/accessDenied";

const BOT = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "").trim();

type Props = {
  /** Например, ошибка входа через Mini App */
  mutedHint?: string;
};

export function TelegramBotLinkAuth({ mutedHint }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [devModeNoBot, setDevModeNoBot] = useState(false);
  const [startError, setStartError] = useState("");
  const [pollHint, setPollHint] = useState("");
  const [expiredToken, setExpiredToken] = useState(false);
  const [loadingStart, setLoadingStart] = useState(true);
  const [copied, setCopied] = useState(false);

  const requestStart = useCallback(async () => {
    setLoadingStart(true);
    setStartError("");
    setPollHint("");
    setExpiredToken(false);
    try {
      const res = await fetch("/api/telegram/browser-auth/start", { method: "POST" });
      const data = (await res.json()) as {
        token?: string;
        openUrl?: string | null;
        error?: string;
        devModeNoBot?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Не удалось получить код входа");
      if (!data.token) throw new Error("Пустой ответ сервера");
      setToken(data.token);
      setOpenUrl(data.openUrl ?? null);
      setDevModeNoBot(Boolean(data.devModeNoBot));
    } catch (e) {
      setToken(null);
      setOpenUrl(null);
      setDevModeNoBot(false);
      setStartError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoadingStart(false);
    }
  }, []);

  useEffect(() => {
    void requestStart();
  }, [requestStart]);

  useEffect(() => {
    if (!token || devModeNoBot) return;

    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/telegram/browser-auth/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token })
        });

        if (res.status === 410) {
          setPollHint("Код истёк. Нажмите «Новый код».");
          setExpiredToken(true);
          window.clearInterval(id);
          return;
        }

        if (res.status === 403) {
          window.clearInterval(id);
          try {
            const data = (await res.json()) as AccessDeniedPayload;
            if (isAccessDeniedResponse(403, data)) {
              window.location.replace("/access-denied");
              return;
            }
            setPollHint(data.error ?? "Нет доступа.");
          } catch {
            setPollHint("Нет доступа.");
          }
          return;
        }

        if (res.status === 202) {
          setPollHint("Ждём подтверждения в Telegram…");
          return;
        }

        if (res.ok) {
          window.clearInterval(id);
          let onboardingRequired = false;
          try {
            const body = (await res.json()) as { onboardingRequired?: boolean };
            onboardingRequired = Boolean(body.onboardingRequired);
          } catch {
            /* cookie уже выставлен */
          }
          window.location.href = onboardingRequired ? "/welcome" : "/schedule";
          return;
        }

        const err = ((await res.json().catch(() => ({}))) as { error?: string }).error;
        if (err) setPollHint(err);
      } catch {
        /* сеть */
      }
    }, 2000);

    return () => window.clearInterval(id);
  }, [token, devModeNoBot]);

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setPollHint("Не удалось скопировать — выделите токен вручную.");
    }
  };

  const botHref = BOT ? `https://t.me/${encodeURIComponent(BOT)}` : "";

  return (
    <div className="space-y-6 text-center">
      {mutedHint ? <p className="text-sm text-muted">{mutedHint}</p> : null}

      {BOT ? (
        <div className="text-sm leading-relaxed text-muted">
          Для входа откройте{" "}
          <Link href={botHref} className="font-semibold text-foreground underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
            @{BOT}
          </Link>{" "}
          в Telegram. Подходит аккаунт из списка доступа приложения.
        </div>
      ) : !devModeNoBot ? (
        <div className="text-sm leading-relaxed text-muted">
          Задайте <span className="font-mono text-[11px] text-foreground/85">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</span> и
          токен бота или включите dev-режим в <span className="font-mono text-[11px]">.env</span>.
        </div>
      ) : null}

      {loadingStart ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="h-9 w-9 animate-spin text-muted" aria-hidden />
          <span className="text-xs text-muted">Готовим код входа…</span>
        </div>
      ) : startError ? (
        <p className="text-sm font-medium text-foreground/85">{startError}</p>
      ) : openUrl ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-primary flex w-full touch-manipulation items-center justify-center gap-2 py-4 text-[13px]"
          data-no-swipe="true"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/25">
            <Send className="h-4 w-4 text-background" aria-hidden />
          </span>
          Открыть бота в Telegram
        </a>
      ) : null}

      {token ? (
        <div className="rounded-lg border border-border bg-transparent p-4 text-left">
          <p className="mb-3 text-center text-xs text-muted">
            {devModeNoBot ? "ТОКЕН ДЛЯ АВТОРИЗАЦИИ" : "Или скопируйте токен и отправьте боту одним сообщением:"}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="min-w-0 flex-1 truncate rounded-xl border border-border bg-transparent px-3 py-2.5 font-mono text-[13px] leading-relaxed tracking-tight text-foreground">
              {token}
            </div>
            <button
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-card",
                copied && "border-foreground/35 text-foreground"
              )}
              onClick={() => void copyToken()}
              data-no-swipe="true"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        </div>
      ) : null}

      {(pollHint || token) && !startError && !devModeNoBot ? (
        <div className="space-y-2">
          {pollHint ? <p className="text-xs font-medium text-muted">{pollHint}</p> : null}
          {token && !pollHint.includes("Нет доступа") ? (
            <p className="text-[11px] leading-relaxed text-muted">
              Не закрывайте эту вкладку: после ответа бота браузер сам перейдёт в приложение.
            </p>
          ) : null}
        </div>
      ) : null}

      {(startError || expiredToken || token) && !loadingStart ? (
        <button
          type="button"
          className="btn-secondary w-full py-3 text-sm font-semibold"
          onClick={() => void requestStart()}
          data-no-swipe="true"
        >
          {startError ? "Повторить" : "Новый код"}
        </button>
      ) : null}
    </div>
  );
}
