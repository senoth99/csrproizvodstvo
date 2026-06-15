import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { createSessionResponseFromTgUser, type TgMiniAppUser } from "@/lib/telegramSignIn";
import { sessionCookieSecure } from "@/lib/sessionCookie";
import { SESSION_TTL_SECONDS } from "@/lib/auth";

export type BrowserLoginToken = {
  raw: string;
  hash: string;
};

export function normalizeBrowserLoginToken(input: string): BrowserLoginToken | null {
  const tokenRaw = input.trim().toLowerCase();
  const normalized = tokenRaw.startsWith("login_") ? tokenRaw.slice("login_".length) : tokenRaw;
  if (!/^[a-f\d]{32}$/.test(normalized)) return null;
  return { raw: normalized, hash: hashToken(normalized) };
}

export type BrowserChallengeStatus = "waiting" | "ready" | "denied" | "expired" | "missing";

export async function getBrowserChallengeStatus(tokenHash: string): Promise<BrowserChallengeStatus> {
  const row = await prisma.telegramLoginChallenge.findUnique({ where: { tokenHash } });
  if (!row) return "missing";
  if (row.expiresAt.getTime() < Date.now()) return "expired";
  if (row.status === "denied") return "denied";
  if (row.status === "ready" && row.telegramId) return "ready";
  return "waiting";
}

export async function consumeBrowserLoginChallenge(token: BrowserLoginToken): Promise<
  | { kind: "waiting" }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "invalid_user" }
  | { kind: "session_error"; response: NextResponse }
  | { kind: "ok"; tgUser: TgMiniAppUser; onboardingRequired: boolean; jwt: string }
> {
  const now = new Date();

  const consumeResult = await prisma.$transaction(async (tx) => {
    const row = await tx.telegramLoginChallenge.findUnique({ where: { tokenHash: token.hash } });
    if (!row) return { kind: "waiting" as const };
    if (row.expiresAt.getTime() < now.getTime()) {
      await tx.telegramLoginChallenge.delete({ where: { id: row.id } }).catch(() => {});
      return { kind: "expired" as const };
    }
    if (row.status === "denied") return { kind: "denied" as const };
    if (row.status !== "ready" || !row.telegramId) return { kind: "waiting" as const };

    const tgUser: TgMiniAppUser = {
      id: Number(row.telegramId),
      username: row.telegramUsername ?? undefined,
      first_name: row.telegramFirstName ?? undefined,
      last_name: row.telegramLastName ?? undefined,
      photo_url: row.telegramPhotoUrl ?? undefined
    };
    if (!Number.isFinite(tgUser.id)) {
      await tx.telegramLoginChallenge.delete({ where: { id: row.id } }).catch(() => {});
      return { kind: "invalid_user" as const };
    }

    const consumed = await tx.telegramLoginChallenge.deleteMany({
      where: {
        id: row.id,
        status: "ready",
        telegramId: { not: null },
        expiresAt: { gt: now }
      }
    });
    if (consumed.count !== 1) return { kind: "waiting" as const };

    return { kind: "ok" as const, tgUser };
  });

  if (consumeResult.kind !== "ok") return consumeResult;

  const sessionRes = await createSessionResponseFromTgUser(consumeResult.tgUser);
  if (sessionRes.status !== 200) {
    return { kind: "session_error", response: sessionRes };
  }

  const body = (await sessionRes.json()) as { onboardingRequired?: boolean };
  const cookie = sessionRes.cookies.get("ps_session")?.value;
  if (!cookie) {
    return {
      kind: "session_error",
      response: NextResponse.json({ error: "Не удалось создать сессию" }, { status: 503 })
    };
  }

  return {
    kind: "ok",
    tgUser: consumeResult.tgUser,
    onboardingRequired: Boolean(body.onboardingRequired),
    jwt: cookie
  };
}

export function browserLoginFinishUrl(rawToken: string): string {
  const base = resolveAppPublicBaseUrl();
  return `${base}/api/telegram/browser-auth/finish?token=${encodeURIComponent(rawToken)}`;
}

export function redirectBrowserLoginSuccess(jwt: string, onboardingRequired: boolean): NextResponse {
  const appBase = resolveAppPublicBaseUrl();
  const path = onboardingRequired ? "/welcome" : "/schedule";
  const res = NextResponse.redirect(new URL(path, appBase));
  res.cookies.set("ps_session", jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
  return res;
}
