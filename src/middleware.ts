import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev_session_secret_change_me"
);

const PUBLIC_PATHS = ["/login/token", "/need-link", "/telegram/login", "/api/telegram/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.includes(".") || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("ps_session")?.value;
  if (!cookie) return NextResponse.redirect(new URL("/telegram/login", req.url));
  try {
    await jwtVerify(cookie, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/telegram/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!api).*)"]
};
