import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { sessionSecretBytes } from "@/lib/sessionSecret";

const PUBLIC_PATHS = [
  "/login/token",
  "/need-link",
  "/access-denied",
  "/telegram/login",
  "/api/telegram/auth",
  "/api/telegram/browser-auth/start",
  "/api/telegram/browser-auth/complete",
  "/api/telegram/browser-auth/dev-session",
  "/api/telegram/webhook"
];

/** Любой сбой внутри middleware в Next превращался бы в сырое Internal Server Error. */
function redirectToTelegramLogin(req: NextRequest): NextResponse {
  try {
    return NextResponse.redirect(new URL("/telegram/login", req.url));
  } catch {
    try {
      return NextResponse.redirect(new URL("/telegram/login", `${resolveAppPublicBaseUrl()}/`));
    } catch {
      return NextResponse.redirect("http://127.0.0.1:3000/telegram/login");
    }
  }
}

async function middlewareInner(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  /*
   Чанки/CSS и файлы из public: любой путь с расширением и всё под `/_next` не проверяем по сессии.
   В dev — бандлеры могут качать ресурсы с префиксом `/@` без точки в пути (иначе Tailwind/CSS «пропадают»).
  */
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.json" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/.well-known") ||
    pathname.startsWith("/sitemap")
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/@")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const cookie = req.cookies.get("ps_session")?.value;
  if (!cookie) return redirectToTelegramLogin(req);
  try {
    await jwtVerify(cookie, sessionSecretBytes());
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return redirectToTelegramLogin(req);
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  try {
    return await middlewareInner(req);
  } catch (e) {
    console.error("[middleware:fatal]", e);
    try {
      return redirectToTelegramLogin(req);
    } catch {
      return NextResponse.redirect("http://127.0.0.1:3000/telegram/login");
    }
  }
}

export const config = {
  matcher: [
    /*
     Не запускать middleware на api и на всём /_next/* (static, flight, webpack-hmr и т.д.) — иначе бывают 500 и «пропадают» стили.
     */
    "/((?!api|_next).*)"
  ]
};
