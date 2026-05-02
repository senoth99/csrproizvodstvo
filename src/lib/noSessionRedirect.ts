import type { NextRequest } from "next/server";

/**
 * Без сессии middleware ведёт на страницу обмена initData или сразу на «доступ запрещён».
 * Mini App и мобильные браузеры → `/telegram/login` (там JS читает initData и ставит cookie).
 * В **production** типичный десктопный браузер → `/access-denied`, без лишнего `/telegram/login`.
 * В development всегда `/telegram/login`, чтобы локально не упираться в «доступ запрещён».
 *
 * В production отключить редирект на /access-denied: `AUTH_DESKTOP_NO_SESSION_ACCESS_DENIED=false`.
 */
export function noSessionRedirectPath(req: NextRequest): "/telegram/login" | "/access-denied" {
  if (process.env.NODE_ENV !== "production") {
    return "/telegram/login";
  }
  if (process.env.AUTH_DESKTOP_NO_SESSION_ACCESS_DENIED === "false") {
    return "/telegram/login";
  }
  const ua = req.headers.get("user-agent") ?? "";
  if (looksLikeTelegramClientUa(ua)) return "/telegram/login";
  if (looksLikeDesktopNonMobileBrowser(ua)) return "/access-denied";
  return "/telegram/login";
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
