"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-full">
        <h1 className="ui-page-title">Ошибка сервера</h1>
        <p className="mt-4 text-sm text-muted">
          Если вы администратор: проверьте{" "}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">DATABASE_URL</code> и лог приложения. Для синхронизации схемы:
        </p>
        <ul className="mt-3 list-inside space-y-1.5 text-left text-[13px] leading-snug text-muted">
          <li>
            локально SQLite:{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">
              npm run prisma:generate && npm run db:push
            </code>
            {" "}или{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">./scripts/dev.sh</code>
          </li>
          <li>
            Postgres / VPS с миграциями:{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">npx prisma migrate deploy</code>
          </li>
        </ul>
        {error.digest ? (
          <p className="mt-3 text-[11px] text-muted">
            digest:{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">{error.digest}</code>
          </p>
        ) : null}
        {isDev ? (
          <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-border bg-background p-3 text-left text-[11px] leading-snug text-muted">
            {error.message}
          </pre>
        ) : null}
      </div>
      <button type="button" onClick={() => reset()} className="btn-primary px-8">
        Попробовать снова
      </button>
    </div>
  );
}
