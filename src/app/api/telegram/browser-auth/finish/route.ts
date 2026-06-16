import { NextResponse } from "next/server";
import {
  consumeBrowserLoginChallenge,
  normalizeBrowserLoginToken,
  redirectBrowserLoginSuccess
} from "@/lib/browserAuthComplete";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { isBrowserTelegramLoginConfigured } from "@/lib/telegramBrowserLogin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isBrowserTelegramLoginConfigured()) {
    return NextResponse.json(
      { error: "Вход из браузера не настроен." },
      { status: 503 }
    );
  }

  const appBase = resolveAppPublicBaseUrl();
  const url = new URL(req.url);
  const tokenRaw = url.searchParams.get("token") ?? "";
  const token = normalizeBrowserLoginToken(tokenRaw);
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=bad_token", appBase));
  }

  try {
    const result = await consumeBrowserLoginChallenge(token);

    if (result.kind === "waiting") {
      return NextResponse.redirect(new URL("/login?error=not_ready", appBase));
    }
    if (result.kind === "expired") {
      return NextResponse.redirect(new URL("/login?error=expired", appBase));
    }
    if (result.kind === "denied") {
      return NextResponse.redirect(new URL("/access-denied", appBase));
    }
    if (result.kind === "invalid_user") {
      return NextResponse.redirect(new URL("/login?error=invalid_user", appBase));
    }
    if (result.kind === "session_error") {
      if (result.response.status === 403) {
        return NextResponse.redirect(new URL("/access-denied", appBase));
      }
      return NextResponse.redirect(new URL("/login?error=session", appBase));
    }

    return redirectBrowserLoginSuccess(result.jwt, result.onboardingRequired);
  } catch (e) {
    console.error("[api/telegram/browser-auth/finish]", e);
    return NextResponse.redirect(new URL("/login?error=server", appBase));
  }
}
