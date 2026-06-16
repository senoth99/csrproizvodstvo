import type { NextRequest } from "next/server";

/**
 * Без сессии middleware ведёт на страницу входа или «доступ запрещён».
 * В **production** при `AUTH_DESKTOP_NO_SESSION_ACCESS_DENIED=true`: десктопный браузер → `/access-denied`.
 * По умолчанию все без сессии идут на `/login`.
 * В development всегда `/login`.
 */
export function noSessionRedirectPath(req: NextRequest): "/login" | "/access-denied" {
  if (process.env.NODE_ENV !== "production") {
    return "/login";
  }
  if (process.env.AUTH_DESKTOP_NO_SESSION_ACCESS_DENIED !== "true") {
    return "/login";
  }
  const ua = req.headers.get("user-agent") ?? "";
  if (looksLikeTelegramClientUa(ua)) return "/login";
  if (looksLikeDesktopNonMobileBrowser(ua)) return "/access-denied";
  return "/login";
}

function looksLikeTelegramClientUa(ua: string): boolean {
  const u = ua.toLowerCase();
  return u.includes("telegram");
}

function looksLikeDesktopNonMobileBrowser(ua: string): boolean {
  const u = ua.toLowerCase();
  if (!u) return false;
  if (u.includes("android")) return false;
  if (u.includes("iphone") || u.includes("ipad") || u.includes("ipod")) return false;
  if (/\bmobile\b/.test(u)) return false;

  if (u.includes("windows nt")) return true;
  if (u.includes("macintosh")) return true;
  if (u.includes("linux x86_64") || u.includes("linux x86_32")) return true;
  if (u.includes("cros ")) return true;
  return false;
}
