"use client";

import { useEffect, useRef } from "react";

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

/** Регистрирует SW, запрашивает разрешение и сохраняет push-подписку на сервере. */
export function PushNotificationSetup() {
  const startedRef = useRef(false);

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
        const { publicKey } = (await keyRes.json()) as { publicKey?: string };
        if (!publicKey) return;

        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

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
        if (!endpoint || !p256dh || !auth) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            endpoint,
            keys: { p256dh, auth },
            userAgent: navigator.userAgent
          })
        });
      } catch (e) {
        console.warn("[PushNotificationSetup]", e);
      }
    })();
  }, []);

  return null;
}
