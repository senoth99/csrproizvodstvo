let registerPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** Регистрирует SW один раз (push + кэш аватаров). */
export function ensureAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  if (!registerPromise) {
    registerPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration)
      .catch((e) => {
        console.warn("[ensureAppServiceWorker]", e);
        registerPromise = null;
        return null;
      });
  }

  return registerPromise;
}
