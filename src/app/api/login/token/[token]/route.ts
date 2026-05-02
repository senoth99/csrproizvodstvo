import { NextResponse } from "next/server";
import { buildSessionPayload, hashToken, signSessionToken } from "@/lib/auth";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { prismaUserAccessSessionSelect } from "@/lib/prismaSafeUserInclude";
import { prisma } from "@/lib/prisma";
import { sessionCookieSecure } from "@/lib/sessionCookie";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const appBase = resolveAppPublicBaseUrl();
  const failRedirect = NextResponse.redirect(new URL("/need-link", appBase));
  try {
    const { token } = await params;
    const tokenHash = hashToken(token);
    const accessToken = await prisma.accessToken.findFirst({
      where: { tokenHash, isActive: true },
      include: { user: { select: prismaUserAccessSessionSelect } }
    });

    if (!accessToken || !accessToken.user.isActive) {
      return NextResponse.redirect(new URL("/need-link", appBase));
    }
    if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
      return NextResponse.redirect(new URL("/need-link", appBase));
    }

    await prisma.accessToken.update({
      where: { id: accessToken.id },
      data: { lastUsedAt: new Date() }
    });

    const jwt = await signSessionToken(buildSessionPayload(accessToken.user));

    const res = NextResponse.redirect(new URL("/schedule", appBase));
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
