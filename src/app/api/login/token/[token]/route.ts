import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev_session_secret_change_me"
);

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = hashToken(token);
  const accessToken = await prisma.accessToken.findFirst({
    where: { tokenHash, isActive: true },
    include: { user: true }
  });

  if (!accessToken || !accessToken.user.isActive) {
    return NextResponse.redirect(new URL("/need-link", process.env.APP_URL ?? "http://localhost:3000"));
  }
  if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/need-link", process.env.APP_URL ?? "http://localhost:3000"));
  }

  await prisma.accessToken.update({
    where: { id: accessToken.id },
    data: { lastUsedAt: new Date() }
  });

  const jwt = await new SignJWT({ userId: accessToken.userId, role: accessToken.user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);

  const res = NextResponse.redirect(new URL("/schedule", process.env.APP_URL ?? "http://localhost:3000"));
  res.cookies.set("ps_session", jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
  return res;
}
