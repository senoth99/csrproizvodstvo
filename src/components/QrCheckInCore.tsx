"use client";

import { CheckCircle2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkplaceQrCameraScanner } from "@/components/WorkplaceQrCameraScanner";
import { formatDateRu, safeParseISO } from "@/lib/utils";

function showInstantNotification(title: string, body: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "qr-check-in-success" });
  } catch {
    /* Safari / ограничения контекста */
  }
}

function extractTokenFromScan(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const k = u.searchParams.get("k")?.trim();
    if (k) return k;
  } catch {
    /* not a URL */
  }
  if (/^[a-f0-9]{32}$/i.test(raw)) return raw.toLowerCase();
  return null;
}

type CheckInSuccess = {
  arrivedAt: string;
  zoneName: string | null;
};

export type QrCheckInCoreProps = {
  zoneName: string;
  /** Сразу открыть камеру. */
  autoStartScanner?: boolean;
  /** Полноэкранный сканер поверх кабинета (без отдельной страницы). */
  embedded?: boolean;
  /** Токен из QR-ссылки /check-in?k=… */
  initialToken?: string;
  onClose?: () => void;
  onSuccess?: () => void;
};

export function QrCheckInCore({
  zoneName,
  autoStartScanner = false,
  embedded = false,
  initialToken,
  onClose,
  onSuccess
}: QrCheckInCoreProps) {
  const autoSubmitted = useRef(false);
  const [scanning, setScanning] = useState(autoStartScanner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<CheckInSuccess | null>(null);

  useEffect(() => {
    if (autoStartScanner) setScanning(true);
  }, [autoStartScanner]);

  const submitCheckIn = useCallback(
    async (token: string) => {
      setBusy(true);
      setError("");
      setScanning(false);
      try {
        const res = await fetch("/api/workplace/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          arrivedAt?: string;
          zoneName?: string | null;
          error?: string;
        };
        if (!res.ok) {
          if (res.status === 401) {
            window.location.replace("/login");
            return;
          }
          if (data.error === "no_shift_today") {
            if (embedded) onClose?.();
            else window.location.replace("/me");
            return;
          }
          throw new Error(
            data.error === "invalid_token"
              ? "Неверный QR-код"
              : data.error === "unauthorized"
                ? "Войдите в приложение"
                : data.error === "other_shift_active"
                  ? "Сначала завершите другую активную смену"
                  : "Не удалось отметиться"
          );
        }
        if (!data.ok || !data.arrivedAt) throw new Error("Не удалось отметиться");
        const result: CheckInSuccess = {
          arrivedAt: data.arrivedAt,
          zoneName: data.zoneName ?? zoneName
        };
        setSuccess(result);
        const zone = result.zoneName ? `${result.zoneName}. ` : "";
        showInstantNotification("Всё отлично!", `Ваша смена начата. ${zone}`.trim());
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
        if (embedded && autoStartScanner) setScanning(true);
      } finally {
        setBusy(false);
      }
    },
    [zoneName, onSuccess, embedded, onClose, autoStartScanner]
  );

  const handleDecoded = useCallback(
    (text: string) => {
      const token = extractTokenFromScan(text);
      if (!token) {
        setError("Не удалось прочитать код. Наведите на QR со ссылкой на отметку.");
        return;
      }
      void submitCheckIn(token);
    },
    [submitCheckIn]
  );

  useEffect(() => {
    const k = initialToken?.trim();
    if (!k || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submitCheckIn(k);
  }, [initialToken, submitCheckIn]);

  const arrivedLabel = success
    ? formatDateRu(safeParseISO(success.arrivedAt), "dd.MM.yyyy HH:mm")
    : "";

  const dismissSuccess = () => {
    setSuccess(null);
    if (embedded) onClose?.();
  };

  const closeScanner = () => {
    setScanning(false);
    onClose?.();
  };

  const retryScanner = () => {
    setError("");
    setScanning(true);
  };

  const scannerBlock = (
    <div className="space-y-3">
      <WorkplaceQrCameraScanner
        active={scanning && !busy}
        onDecoded={handleDecoded}
        onError={(msg) => {
          setScanning(false);
          setError(msg);
        }}
      />
      {!embedded ? (
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={busy}
          onClick={() => setScanning(false)}
        >
          Закрыть камеру
        </button>
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <>
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Сканирование QR"
          data-no-swipe="true"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-display text-muted">Начать смену</p>
              <p className="truncate text-sm font-semibold text-foreground">{zoneName}</p>
            </div>
            <button
              type="button"
              onClick={closeScanner}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted"
              aria-label="Закрыть сканер"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {scanning ? (
              scannerBlock
            ) : (
              <div className="space-y-3 text-center">
                {error ? <p className="text-sm font-medium text-foreground/90">{error}</p> : null}
                <button type="button" className="btn-primary w-full" onClick={retryScanner}>
                  Снова открыть камеру
                </button>
              </div>
            )}
            {scanning && error ? <p className="mt-3 text-center text-sm font-medium text-foreground/90">{error}</p> : null}
          </div>
        </div>

        {success ? (
          <div className="manager-modal-overlay z-[210]">
            <div className="manager-modal-panel relative border-accent/40">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-accent">
                  <CheckCircle2 className="h-8 w-8" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold">Всё отлично!</p>
                  <p className="mt-1 text-base font-semibold text-foreground">Ваша смена начата</p>
                  {success.zoneName ? (
                    <p className="mt-2 text-sm text-muted">
                      {success.zoneName} · приход {arrivedLabel}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Приход: {arrivedLabel}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={dismissSuccess}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted"
                  aria-label="Закрыть"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button type="button" className="btn-primary mt-5 w-full" onClick={dismissSuccess}>
                Отлично
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Сканировать QR</h1>
      <p className="text-sm text-muted">
        Смена на сегодня: <span className="font-medium text-foreground">{zoneName}</span>. Наведите камеру на QR-код
        на производстве — смена начнётся автоматически.
      </p>

      {!scanning ? (
        <button
          type="button"
          onClick={retryScanner}
          disabled={busy}
          className="btn-primary w-full min-h-[48px] touch-manipulation disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? "Обрабатываем…" : "Сканировать QR"}
        </button>
      ) : (
        scannerBlock
      )}

      {error ? <p className="text-sm font-medium text-foreground/90">{error}</p> : null}

      {success ? (
        <div className="manager-modal-overlay">
          <div className="manager-modal-panel relative border-accent/40">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-accent">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold">Всё отлично!</p>
                <p className="mt-1 text-base font-semibold text-foreground">Ваша смена начата</p>
                {success.zoneName ? (
                  <p className="mt-2 text-sm text-muted">
                    {success.zoneName} · приход {arrivedLabel}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted">Приход: {arrivedLabel}</p>
                )}
              </div>
              <button
                type="button"
                onClick={dismissSuccess}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button type="button" className="btn-primary mt-5 w-full" onClick={dismissSuccess}>
              Отлично
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
