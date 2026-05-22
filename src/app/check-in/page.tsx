"use client";

import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { WorkplaceQrCameraScanner } from "@/components/WorkplaceQrCameraScanner";
import { formatDateRu, safeParseISO } from "@/lib/utils";

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

function CheckInPageInner() {
  const searchParams = useSearchParams();
  const autoSubmitted = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ arrivedAt: string } | null>(null);

  const submitCheckIn = useCallback(async (token: string) => {
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
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 401) {
          window.location.replace("/telegram/login");
          return;
        }
        throw new Error(
          data.error === "invalid_token"
            ? "Неверный QR-код"
            : data.error === "unauthorized"
              ? "Войдите в приложение"
              : "Не удалось отметиться"
        );
      }
      if (!data.ok || !data.arrivedAt) throw new Error("Не удалось отметиться");
      setSuccess({ arrivedAt: data.arrivedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }, []);

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
    const k = searchParams.get("k")?.trim();
    if (!k || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submitCheckIn(k);
  }, [searchParams, submitCheckIn]);

  const arrivedLabel = success
    ? formatDateRu(safeParseISO(success.arrivedAt), "dd.MM.yyyy HH:mm")
    : "";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Отметить приход</h1>
      <p className="text-sm text-muted">
        Наведите камеру на QR-код на производстве. После успешного скана появится подтверждение.
      </p>

      {!scanning ? (
        <button
          type="button"
          onClick={() => {
            setError("");
            setScanning(true);
          }}
          disabled={busy}
          className="btn-primary w-full min-h-[48px] touch-manipulation disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? "Отмечаем…" : "Сканировать QR"}
        </button>
      ) : (
        <div className="space-y-3">
          <WorkplaceQrCameraScanner
            active={scanning && !busy}
            onDecoded={handleDecoded}
            onError={(msg) => {
              setScanning(false);
              setError(msg);
            }}
          />
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={busy}
            onClick={() => setScanning(false)}
          >
            Закрыть камеру
          </button>
        </div>
      )}

      {error ? <p className="text-sm font-medium text-foreground/90">{error}</p> : null}

      {success ? (
        <div className="manager-modal-overlay">
          <div className="manager-modal-panel">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-center">
                <p className="text-lg font-bold">Вы успешно отметились</p>
                {arrivedLabel ? <p className="mt-2 text-sm text-muted">{arrivedLabel}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setSuccess(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => setSuccess(null)}>
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">Загрузка…</div>
      }
    >
      <CheckInPageInner />
    </Suspense>
  );
}
