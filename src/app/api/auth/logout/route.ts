import { NextResponse } from "next/server";
import { COOKIE_NAME, clearSessionCookie } from "@/lib/auth";
import { sessionCookieSecure } from "@/lib/sessionCookie";

export async function POST() {
  try {
    await clearSessionCookie();
  } catch {
    /* cookie store may be unavailable in edge cases */
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 0
  });
  return res;
}
