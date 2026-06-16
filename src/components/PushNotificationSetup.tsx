"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { ensureAppServiceWorker } from "@/lib/appServiceWorker";
import { isStandalonePwa } from "@/lib/pwa";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "push-prompt-dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

async function subscribeToPush(publicKey: string): Promise<boolean> {
  const registration = await ensureAppServiceWorker();
  if (!registration) return false;
  await navigator.serviceWorker.ready;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return false;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
    }));

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent
    })
  });

  return res.ok;
}

/** Регистрирует SW, подписывает push и показывает баннер для запроса разрешения. */
export function PushNotificationSetup() {
  const startedRef = useRef(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [iosHint, setIosHint] = useState(false);

  const enablePush = useCallback(async () => {
    if (!publicKey || subscribing) return;
    setSubscribing(true);
    try {
      const ok = await subscribeToPush(publicKey);
      if (ok) {
        sessionStorage.setItem(DISMISS_KEY, "1");
        setShowPrompt(false);
      }
    } catch (e) {
      console.warn("[PushNotificationSetup]", e);
    } finally {
      setSubscribing(false);
    }
  }, [publicKey, subscribing]);

  const dismissPrompt = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShowPrompt(false);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return;
      }

      try {
        const keyRes = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
        if (!keyRes.ok) return;
        const { publicKey: key } = (await keyRes.json()) as { publicKey?: string };
        if (!key) return;

        setPublicKey(key);
        setIosHint(isIos() && !isStandalonePwa());

        if (Notification.permission === "granted") {
          await subscribeToPush(key);
          return;
        }

        if (Notification.permission === "default" && sessionStorage.getItem(DISMISS_KEY) !== "1") {
          setShowPrompt(true);
        }
      } catch (e) {
        console.warn("[PushNotificationSetup]", e);
      }
    })();
  }, []);

  if (!showPrompt) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-[60] px-3 pb-[env(safe-area-inset-bottom)]",
        "bottom-[calc(3.5rem+env(safe-area-inset-bottom))]"
      )}
      role="region"
      aria-label="Включение push-уведомлений"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3 rounded-xl border border-border bg-zinc-950/95 p-3 shadow-lg backdrop-blur-sm">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Включить уведомления?</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Смены, отчёты и заявки — даже когда вкладка закрыта.
            {iosHint ? " На iPhone: «Поделиться» → «На экран Домой», затем откройте оттуда." : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void enablePush()}
              disabled={subscribing}
              className="inline-flex min-h-9 touch-manipulation items-center rounded-lg bg-foreground px-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
            >
              {subscribing ? "Подключаем…" : "Включить"}
            </button>
            <button
              type="button"
              onClick={dismissPrompt}
              className="inline-flex min-h-9 touch-manipulation items-center rounded-lg px-3 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Не сейчас
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissPrompt}
          className="inline-flex min-h-9 min-w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
