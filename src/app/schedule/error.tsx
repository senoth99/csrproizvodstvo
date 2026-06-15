"use client";

import { useEffect } from "react";

/** Ошибка на /schedule — понятный текст вместо английского digest Next.js. */
export default function ScheduleError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[schedule/error]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <div className="card space-y-3 border-highlight/35 bg-highlight/10 p-4 text-sm">
      <p className="font-semibold">Не удалось обновить график</p>
      <p className="text-muted leading-relaxed">
        Страница не смогла загрузить данные с сервера. Обычно это временный сбой или база на сервере не
        синхронизирована после обновления. Попробуйте ещё раз через несколько секунд.
      </p>
      {error.digest ? (
        <p className="text-[11px] text-muted">
          Код для админа:{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono">{error.digest}</code>
        </p>
      ) : null}
      <button type="button" onClick={() => reset()} className="btn-primary w-full sm:w-auto">
        Обновить
      </button>
    </div>
  );
}
