import { NextResponse } from "next/server";
import { prisma, normalizeDatabaseUrlEnv } from "@/lib/prisma";
import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums";
import { ACCESS_DENIED_CODE } from "@/lib/accessDenied";
import { buildSessionPayload, signSessionToken } from "@/lib/auth";
import { sessionCookieSecure } from "@/lib/sessionCookie";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

/** Mini App payload from initData JSON */
export type TgMiniAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

export async function getTelegramAllowanceRole(tgUser: TgMiniAppUser): Promise<UserRoleValue | null> {
  const adminUsername = (process.env.TELEGRAM_ADMIN_USERNAME ?? "contact_voropaev").replace("@", "").toLowerCase();
  const normalizedUsername = (tgUser.username ?? "").toLowerCase();
  const allowed = await prisma.allowedTelegramUser.findFirst({
    where: { username: normalizedUsername, isActive: true }
  });
  const fallbackAdminAllowed = normalizedUsername === adminUsername;
  if (!allowed && !fallbackAdminAllowed) return null;
  return (
    (allowed?.role as UserRoleValue | undefined) ??
    (fallbackAdminAllowed ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE)
  );
}

export type TelegramSessionOptions = {
  /** Только с защищённых dev-маршрутов при TELEGRAM_ALLOW_DEV_LOGIN */
  forcedRole?: UserRoleValue;
};

export async function createSessionResponseFromTgUser(
  tgUser: TgMiniAppUser,
  options?: TelegramSessionOptions
): Promise<NextResponse> {
  try {
    const role = options?.forcedRole ?? (await getTelegramAllowanceRole(tgUser));
    if (!role) {
      return NextResponse.json(
        { error: "Доступ не выдан. Обратитесь к администратору.", code: ACCESS_DENIED_CODE },
        { status: 403 }
      );
    }
    const displayName =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim() || `tg_${tgUser.id}`;

    const normalizedUsername = (tgUser.username ?? "").toLowerCase();
    let isManagerFlag = false;
    if (options?.forcedRole) {
      const prev = await prisma.user.findUnique({ where: { telegramId: String(tgUser.id) } });
      isManagerFlag = prev?.isManager ?? false;
    } else if (normalizedUsername) {
      const allow = await prisma.allowedTelegramUser.findFirst({
        where: { username: normalizedUsername, isActive: true }
      });
      if (allow) isManagerFlag = allow.isManager;
    }

    const user = await prisma.user.upsert({
      where: { telegramId: String(tgUser.id) },
      update: {
        telegramUsername: tgUser.username ?? null,
        telegramPhotoUrl: tgUser.photo_url ?? null,
        isActive: true,
        role,
        isManager: isManagerFlag
      },
      create: {
        telegramId: String(tgUser.id),
        telegramUsername: tgUser.username ?? null,
        telegramPhotoUrl: tgUser.photo_url ?? null,
        firstName: tgUser.first_name ?? null,
        lastName: tgUser.last_name ?? null,
        name: displayName,
        role,
        isActive: true,
        profileCompleted: false,
        isManager: isManagerFlag
      }
    });

    const jwt = await signSessionToken(buildSessionPayload(user));
    const res = NextResponse.json({
      ok: true,
      role: user.role,
      onboardingRequired: !user.profileCompleted
    });
    res.cookies.set("ps_session", jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: sessionCookieSecure(),
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });
    return res;
  } catch (e) {
    console.error("[createSessionResponseFromTgUser] DB или сессия:", e);
    const isSqlite = normalizeDatabaseUrlEnv(process.env.DATABASE_URL).startsWith("file:");
    const hint = isSqlite
      ? "Локальный SQLite: выполните npx prisma db push и при необходимости npm run prisma:seed. В .env: DATABASE_URL=file:./dev.db (файл создаётся в папке prisma/)."
      : "Проверьте DATABASE_URL и выполните npx prisma migrate deploy (или prisma db push).";
    return NextResponse.json(
      { error: `База недоступна. ${hint}`, code: "SERVICE_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
