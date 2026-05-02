/** Показывается вместо страницы, если запрос к БД не удался (без краша всего приложения с 500). */
export function ServiceUnavailable({ scope }: { scope?: string } = {}) {
  const isDev = process.env.NODE_ENV === "development";
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <div>
        <p className="text-base font-semibold">База данных недоступна</p>
        <p className="mt-2 text-sm text-muted">
          Сервер не смог выполнить запрос к базе (часто после обновления кода без синхронизации схемы, неверная{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">DATABASE_URL</code>, нет доступа к
          файлу SQLite и т.&nbsp;p.).
        </p>
        {scope ? (
          <p className="mt-3 text-[13px] text-muted">
            Код ошибки страницы:{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">{scope}</code>. В терминале, где запущен
            сервер Next.js, найдите строку{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">{`[DB:${scope}]`}</code> — там будет
            причина из Prisma.
          </p>
        ) : null}
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-foreground/85">SQLite локально:</span> в корне проекта выполните{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">
            npm run prisma:generate &amp;&amp; npm run db:push
          </code>
          {" "}
          и перезапустите приложение — или сразу <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">
            ./scripts/dev.sh
          </code>.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-foreground/85">Сборка/VPS как в деплое:</span> там схема подтягивается
          через{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">npx prisma db push</code>
          {""}
          (<code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">deploy.sh</code>). После изменений в{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">prisma/schema.prisma</code> перезапустите
          деплой/контейнеры.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Если в проекте настроены миграции под Postgres:&nbsp;
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">npx prisma migrate deploy</code>.
        </p>
        {isDev ? (
          <p className="mt-3 text-xs text-muted/90">
            Подсказка: сообщение «нет колонки / unknown column …» означает, что нужен{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">npm run db:push</code> под текущий{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">DATABASE_URL</code>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
