import { NextResponse } from "next/server";
import { buildSessionPayload, hashToken, isProfileReady, signSessionToken, SESSION_TTL_SECONDS } from "@/lib/auth";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { prismaUserAccessSessionSelect } from "@/lib/prismaSafeUserInclude";
import { prisma } from "@/lib/prisma";
import { sessionCookieSecure } from "@/lib/sessionCookie";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const appBase = resolveAppPublicBaseUrl();
  const failRedirect = NextResponse.redirect(new URL("/need-link", appBase));
  try {
    const { token } = await params;
    const tokenHash = hashToken(token);
    const now = new Date();

    const consumed = await prisma.accessToken.updateMany({
      where: {
        tokenHash,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      data: { lastUsedAt: now, isActive: false }
    });

    if (consumed.count !== 1) {
      return failRedirect;
    }

    const accessToken = await prisma.accessToken.findFirst({
      where: { tokenHash },
      include: { user: { select: { ...prismaUserAccessSessionSelect, phone: true } } }
    });

    if (!accessToken || !accessToken.user.isActive) {
      return failRedirect;
    }

    const jwt = await signSessionToken(buildSessionPayload(accessToken.user));
    const redirectPath = isProfileReady(accessToken.user) ? "/schedule" : "/welcome";

    const res = NextResponse.redirect(new URL(redirectPath, appBase));
    res.cookies.set("ps_session", jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: sessionCookieSecure(),
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });

    return res;
  } catch (e) {
    console.error("[api/login/token]", e);
    return failRedirect;
  }
}
