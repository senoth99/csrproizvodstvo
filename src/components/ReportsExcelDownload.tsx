"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";

const EXPORT_URL = "/api/export/reports.xlsx";

function isMobileSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && /Safari/i.test(navigator.userAgent);
}

function parseFilename(res: Response): string {
  const raw = res.headers.get("Content-Disposition") ?? "";
  const star = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* ignore */
    }
  }
  const plain = raw.match(/filename="([^"]+)"/i);
  if (plain?.[1]) return plain[1];
  return "otchety.xlsx";
}

export function ReportsExcelDownload() {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const download = () => {
    setError("");
    start(async () => {
      try {
        // iOS Safari: fetch+blob часто не сохраняет файл — открываем URL напрямую (cookie уйдёт с запросом).
        if (isMobileSafari()) {
          const tab = window.open(EXPORT_URL, "_blank", "noopener,noreferrer");
          if (!tab) window.location.assign(EXPORT_URL);
          return;
        }

        const res = await fetch(EXPORT_URL, { method: "GET", credentials: "include" });
        const contentType = res.headers.get("Content-Type") ?? "";

        if (!res.ok || contentType.includes("application/json")) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(
            data.error === "database_unavailable"
              ? "База не синхронизирована. Запустите migrate deploy на сервере."
              : data.error === "Unauthorized"
                ? "Нет прав на выгрузку."
                : "Не удалось сформировать файл. Попробуйте ещё раз."
          );
          return;
        }

        const blob = await res.blob();
        const filename = parseFilename(res);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError("Ошибка сети. Проверьте соединение и попробуйте снова.");
      }
    });
  };

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        className="btn-secondary inline-flex items-center justify-center gap-2 touch-manipulation"
        disabled={pending}
        onClick={download}
      >
        <Download size={16} aria-hidden />
        {pending ? "Формируем…" : "Скачать Excel"}
      </button>
      {error ? <p className="text-xs text-muted">{error}</p> : null}
    </div>
  );
}
