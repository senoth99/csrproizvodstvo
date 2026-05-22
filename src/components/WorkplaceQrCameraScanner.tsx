"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  active: boolean;
  onDecoded: (text: string) => void;
  onError?: (message: string) => void;
};

export function WorkplaceQrCameraScanner({ active, onDecoded, onError }: Props) {
  const reactId = useId();
  const regionId = `qr-reader-${reactId.replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!active) {
      handledRef.current = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        void s
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear();
            } catch {
              /* ignore */
            }
          });
      }
      return;
    }

    let cancelled = false;
    handledRef.current = false;
    setStarting(true);

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(regionId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decoded) => {
            if (cancelled || handledRef.current) return;
            handledRef.current = true;
            onDecoded(decoded);
          },
          () => {
            /* scan tick without match */
          }
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (!cancelled) {
          setStarting(false);
          onError?.(
            e instanceof Error
              ? e.message.includes("NotAllowed")
                ? "Разрешите доступ к камере в настройках браузера."
                : e.message
              : "Не удалось включить камеру."
          );
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        void s
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear();
            } catch {
              /* ignore */
            }
          });
      }
    };
  }, [active, onDecoded, onError, regionId]);

  if (!active) return null;

  return (
    <div className="space-y-2">
      <div
        id={regionId}
        className="overflow-hidden rounded-xl border border-border bg-black [&_video]:!object-cover"
      />
      {starting ? <p className="text-center text-xs text-muted">Включаем камеру…</p> : null}
    </div>
  );
}
