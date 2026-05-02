/**
 * Оборачивает любой код с обращением к БД при рендере страницы или в API:
 * ошибка подключения / несогласованная схема → не пробрасывать необработанное исключение (500).
 *
 * Не перехватываем redirect()/`NEXT_REDIRECT` — иначе Next ломает навигацию и бывают некорректные ответы.
 */
export type DbResult<T> = { ok: true; data: T } | { ok: false; digest?: string };

/** См. `next/dist/client/components/redirect-error`: digest начинается с `NEXT_REDIRECT`. */
export function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.split(";")[0] === "NEXT_REDIRECT";
}

/** `notFound()`, `forbidden()`, `unauthorized()` — digest вида `NEXT_HTTP_ERROR_FALLBACK;404`. */
export function isNextHttpAccessFallbackError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  const [prefix, code] = digest.split(";");
  return prefix === "NEXT_HTTP_ERROR_FALLBACK" && ["404", "403", "401"].includes(code ?? "");
}

export async function catchDb<T>(scope: string, fn: () => Promise<T>): Promise<DbResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (isNextRedirectError(e) || isNextHttpAccessFallbackError(e)) throw e;
    const digest = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error(`[DB:${scope}]`, digest, e);
    return { ok: false, digest };
  }
}
