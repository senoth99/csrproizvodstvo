import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { UserRole, type UserRole as UserRoleValue } from "./enums";
import { isNextHttpAccessFallbackError, isNextRedirectError } from "./dbBoundary";
import { sessionSecretBytes } from "./sessionSecret";
import { sessionCookieSecure } from "./sessionCookie";

const COOKIE_NAME = "ps_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

/** Данные, прошитые в JWT — layout читает оболочку без запроса в БД. */
export type SessionPayload = {
  userId: string;
  role: UserRoleValue;
  isManager: boolean;
  profileCompleted: boolean;
  /** уже lower-case, может быть "" */
  telegramUsername: string;
  name: string;
};

/** Мини-пользователь только для корневого layout (шапка / навигация). */
export type ShellSessionUser = {
  id: string;
  role: string;
  isManager: boolean;
  profileCompleted: boolean;
  telegramUsername: string | null;
  name: string;
};

export function buildSessionPayload(user: {
  id: string;
  role: string;
  isManager: boolean;
  profileCompleted: boolean;
  telegramUsername: string | null;
  name: string;
}): SessionPayload {
  const role =
    user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN || user.role === UserRole.EMPLOYEE
      ? (user.role as UserRoleValue)
      : UserRole.EMPLOYEE;
  return {
    userId: user.id,
    role,
    isManager: Boolean(user.isManager),
    profileCompleted: Boolean(user.profileCompleted),
    telegramUsername: (user.telegramUsername ?? "").trim().toLowerCase(),
    name: user.name
  };
}

export async function signSessionToken(payload: SessionPayload) {
  const secret = sessionSecretBytes();
  return new SignJWT({
    ...payload,
    /** совместимость: старые проверки смотрят на role в корне payload */
    sub: payload.userId
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export const generateRawToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

type VerifyCookie =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ok"; payload: Record<string, unknown> };

/**
 * Не оборачиваем в React `cache()`: вместе с `cookies()` в Next 15 на части маршрутов это давало
 * «Internal Server Error» при RSC (некорректная дедупликация контекста запроса).
 */
export async function verifySessionCookie(): Promise<VerifyCookie> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return { kind: "none" };
    const { payload } = await jwtVerify(token, sessionSecretBytes());
    return { kind: "ok", payload: payload as Record<string, unknown> };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[verifySessionCookie]", e instanceof Error ? e.message : e);
    }
    return { kind: "invalid" };
  }
}

function isRichSessionPayload(p: Record<string, unknown>): p is SessionPayload & Record<string, unknown> {
  return (
    typeof p.userId === "string" &&
    typeof p.role === "string" &&
    typeof p.isManager === "boolean" &&
    typeof p.profileCompleted === "boolean" &&
    typeof p.telegramUsername === "string" &&
    typeof p.name === "string"
  );
}

/** Для RootLayout — без полного prisma.user там, где JWT уже богатый (новые сессии). */
export async function getShellSessionUser(): Promise<ShellSessionUser | null> {
  try {
    const v = await verifySessionCookie();
    if (v.kind !== "ok") return null;
    const p = v.payload;
    const userId = p.userId as string | undefined;
    const role = p.role as string | undefined;
    if (!userId || !role) return null;

    if (isRichSessionPayload(p)) {
      const tu = p.telegramUsername.trim().toLowerCase();
      return {
        id: userId,
        role,
        isManager: p.isManager,
        profileCompleted: p.profileCompleted,
        telegramUsername: tu.length > 0 ? tu : null,
        name: p.name
      };
    }

    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          isManager: true,
          profileCompleted: true,
          telegramUsername: true,
          name: true,
          isActive: true
        }
      });
      if (!u || !u.isActive) return null;
      return {
        id: u.id,
        role: u.role,
        isManager: u.isManager,
        profileCompleted: u.profileCompleted,
        telegramUsername: u.telegramUsername ? u.telegramUsername.toLowerCase() : null,
        name: u.name
      };
    } catch {
      return null;
    }
  } catch (e) {
    console.error("[getShellSessionUser]", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  try {
    const jwt = await signSessionToken(payload);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: sessionCookieSecure(),
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });
  } catch (e) {
    console.error("[createSession]", e instanceof Error ? e.message : e);
    throw e instanceof Error ? e : new Error("Не удалось создать сессию");
  }
}

/** Обновить cookie после смены профиля / полей из JWT на сервере. */
export async function refreshSessionCookieForUserId(userId: string) {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isManager: true,
        profileCompleted: true,
        telegramUsername: true,
        name: true,
        isActive: true
      }
    });
    if (!u || !u.isActive) return;
    await createSession(buildSessionPayload(u));
  } catch (e) {
    console.error("[refreshSessionCookieForUserId]", e instanceof Error ? e.message : e);
  }
}

export async function getCurrentUser() {
  try {
    const v = await verifySessionCookie();
    if (v.kind !== "ok") return null;
    const userId = v.payload.userId as string | undefined;
    if (!userId) return null;

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) return null;
      return user;
    } catch {
      return null;
    }
  } catch (e) {
    console.error("[getCurrentUser]", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function requireRole(roles: UserRoleValue[]) {
  try {
    const user = await getCurrentUser();
    if (!user) redirect("/telegram/login");
    if (!user.profileCompleted) redirect("/welcome");
    const role = Object.values(UserRole).includes(user.role as UserRoleValue)
      ? (user.role as UserRoleValue)
      : UserRole.EMPLOYEE;
    if (!roles.includes(role)) redirect("/schedule");
    return user;
  } catch (e) {
    if (isNextRedirectError(e)) throw e;
    console.error("[requireRole]", e instanceof Error ? e.message : e);
    redirect("/telegram/login");
  }
}

export async function requireAuth() {
  try {
    const user = await getCurrentUser();
    if (!user) redirect("/telegram/login");
    if (!user.profileCompleted) redirect("/welcome");
    return user;
  } catch (e) {
    if (isNextRedirectError(e) || isNextHttpAccessFallbackError(e)) throw e;
    console.error("[requireAuth]", e instanceof Error ? e.message : e);
    redirect("/telegram/login");
  }
}

export type ApiSessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Для App Router Route Handlers: не использовать redirect() — только NextResponse JSON. Иначе часто бывает 500. */
export async function requireRoleApi(
  roles: UserRoleValue[]
): Promise<{ ok: true; user: ApiSessionUser } | { ok: false; response: NextResponse }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    if (!user.profileCompleted) {
      return { ok: false, response: NextResponse.json({ error: "Profile incomplete" }, { status: 403 }) };
    }
    const role = Object.values(UserRole).includes(user.role as UserRoleValue)
      ? (user.role as UserRoleValue)
      : UserRole.EMPLOYEE;
    if (!roles.includes(role)) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { ok: true, user };
  } catch (e) {
    console.error("[requireRoleApi]", e instanceof Error ? e.message : e);
    return {
      ok: false,
      response: NextResponse.json({ error: "Service unavailable", code: "AUTH_LAYER" }, { status: 503 })
    };
  }
}
