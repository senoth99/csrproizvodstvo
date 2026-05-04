/**
 * Точка расширения Next (см. https://nextjs.org/docs/app/guides/instrumentation).
 *
 * Не вызываем здесь `prisma`/CLI: бандлер Next при компиляции `instrumentation.ts` не подключает Node builtins
 * (`child_process` → «module not found», `import("node:…")` → UnhandledSchemeError) — это давало сырой 500.
 *
 * Синхронизация SQLite: `npm run db:push`, `./scripts/dev.sh` или `npm run dev:fresh`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  process.env.TZ = "Europe/Moscow";

  try {
    const dbUrl = (process.env.DATABASE_URL ?? "").trim();
    if (process.env.NODE_ENV === "development" && !dbUrl) {
      console.warn("[instrumentation] DATABASE_URL пуст — для SQLite задайте file:./dev.db (см. .env.example).");
    }
  } catch (e) {
    console.error("[instrumentation] register error", e);
  }
}
