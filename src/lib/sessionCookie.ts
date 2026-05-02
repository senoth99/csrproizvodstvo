import { parsePublicEnvUrl } from "@/lib/appUrl";

/**
 * Флаг Secure для ps_session:
 * — по умолчанию берём протокол из APP_URL / NEXT_PUBLIC_APP_URL (HTTPS → secure);
 * — на http://localhost и http://192.168.* без HTTPS браузеры иначе отбросят cookie;
 * — SESSION_COOKIE_SECURE=true|false принудительно.
 */
export function sessionCookieSecure(): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "false") return false;
  if (process.env.SESSION_COOKIE_SECURE === "true") return true;

  const bases = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""
  ].filter(Boolean) as string[];

  if (!bases.length) return false;

  for (const raw of bases) {
    try {
      const url = parsePublicEnvUrl(raw, "http://localhost:3000");
      return url.protocol === "https:";
    } catch {
      continue;
    }
  }

  return false;
}
