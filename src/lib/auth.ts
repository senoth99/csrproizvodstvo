import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { UserRole, type UserRole as UserRoleValue } from "./enums";

const COOKIE_NAME = "ps_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev_session_secret_change_me"
);

type SessionPayload = {
  userId: string;
  role: UserRoleValue;
};

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export const generateRawToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(payload: SessionPayload) {
  const jwt = await signSessionToken(payload);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireRole(roles: UserRoleValue[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/telegram/login");
  if (!user.profileCompleted) redirect("/welcome");
  const role = Object.values(UserRole).includes(user.role as UserRoleValue)
    ? (user.role as UserRoleValue)
    : UserRole.EMPLOYEE;
  if (!roles.includes(role)) redirect("/schedule");
  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/telegram/login");
  if (!user.profileCompleted) redirect("/welcome");
  return user;
}
