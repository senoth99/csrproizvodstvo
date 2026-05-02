import { stripOptionalEnvQuotes } from "@/lib/envNormalize";

const LOCAL_FALLBACK = "http://localhost:3000";

/**
 * Строку из APP_URL превращает в валидный URL: без схемы добавляет `http://`
 * (иначе `localhost:3000` ломает `new URL` или даёт 500 на редиректах).
 */
export function parsePublicEnvUrl(rawInput: string | undefined, fallback: string = LOCAL_FALLBACK): URL {
  let s = stripOptionalEnvQuotes(rawInput).trim();
  if (!s) s = fallback.trim() || LOCAL_FALLBACK;
  if (!/^https?:\/\//i.test(s)) {
    s = `http://${s.replace(/^\/+/, "")}`;
  }
  try {
    return new URL(s);
  } catch {
    try {
      return new URL(fallback.trim() || LOCAL_FALLBACK);
    } catch {
      return new URL(LOCAL_FALLBACK);
    }
  }
}

/**
 * Абсолютный базовый URL приложения без завершающего «/».
 */
export function resolveAppPublicBaseUrl(): string {
  const combined =
    stripOptionalEnvQuotes(process.env.APP_URL)?.trim() ||
    stripOptionalEnvQuotes(process.env.NEXT_PUBLIC_APP_URL)?.trim() ||
    "";
  const u = parsePublicEnvUrl(combined || undefined, LOCAL_FALLBACK);
  return `${u.origin}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}`;
}
