import { NextResponse } from "next/server";
import { prisma, normalizeDatabaseUrlEnv } from "@/lib/prisma";
import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums";
import { ACCESS_DENIED_CODE } from "@/lib/accessDenied";
import { buildSessionPayload, isProfileReady, signSessionToken, SESSION_TTL_SECONDS } from "@/lib/auth";
import { sessionCookieSecure } from "@/lib/sessionCookie";

/** Mini App payload from initData JSON */
export type TgMiniAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

export type TelegramAllowance = {
  role: UserRoleValue;
  isManager: boolean;
  allowedId: string | null;
};

export async function resolveTelegramAllowance(tgUser: TgMiniAppUser): Promise<TelegramAllowance | null> {
  const rawAdminUser = process.env.TELEGRAM_ADMIN_USERNAME?.trim();
  const adminUsername =
    rawAdminUser && rawAdminUser.length > 0 ? rawAdminUser.replace(/^@+/, "").toLowerCase() : null;
  const adminTgId = process.env.TELEGRAM_ADMIN_TELEGRAM_ID?.trim();
  const normalizedUsername = (tgUser.username ?? "").toLowerCase();
  let allowed =
    normalizedUsername.length > 0
      ? await prisma.allowedTelegramUser.findFirst({
          where: { username: normalizedUsername, isActive: true }
        })
      : null;
  if (!allowed && tgUser.id != null) {
    allowed = await prisma.allowedTelegramUser.findFirst({
      where: { telegramId: String(tgUser.id), isActive: true }
    });
  }
  const fallbackByUsername =
    adminUsername !== null && normalizedUsername.length > 0 && normalizedUsername === adminUsername;
  const fallbackById = Boolean(adminTgId && String(tgUser.id) === adminTgId);
  const fallbackAdminAllowed = fallbackByUsername || fallbackById;
  if (!allowed && !fallbackAdminAllowed) return null;
  return {
    role:
      (allowed?.role as UserRoleValue | undefined) ??
      (fallbackAdminAllowed ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE),
    isManager: allowed?.isManager ?? false,
    allowedId: allowed?.id ?? null
  };
}

export async function getTelegramAllowanceRole(tgUser: TgMiniAppUser): Promise<UserRoleValue | null> {
  const allowance = await resolveTelegramAllowance(tgUser);
  return allowance?.role ?? null;
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
    const allowance = options?.forcedRole ? null : await resolveTelegramAllowance(tgUser);
    const role = options?.forcedRole ?? allowance?.role;
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
    } else {
      isManagerFlag = allowance?.isManager ?? false;
    }

    const user = await prisma.user.upsert({
      where: { telegramId: String(tgUser.id) },
      update: {
        telegramUsername: normalizedUsername.length > 0 ? normalizedUsername : null,
        telegramPhotoUrl: tgUser.photo_url ?? null,
        role,
        isManager: isManagerFlag,
        ...(options?.forcedRole
          ? {
              firstName: tgUser.first_name ?? null,
              lastName: tgUser.last_name ?? null,
              name: displayName
            }
          : {})
      },
      create: {
        telegramId: String(tgUser.id),
        telegramUsername: normalizedUsername.length > 0 ? normalizedUsername : null,
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

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Доступ не выдан. Обратитесь к администратору.", code: ACCESS_DENIED_CODE },
        { status: 403 }
      );
    }

    if (!options?.forcedRole) {
      try {
        const tid = String(tgUser.id);
        let allowedRow =
          normalizedUsername.length > 0
            ? await prisma.allowedTelegramUser.findFirst({
                where: { username: normalizedUsername, isActive: true }
              })
            : null;
        if (!allowedRow) {
          allowedRow = await prisma.allowedTelegramUser.findFirst({
            where: { telegramId: tid, isActive: true }
          });
        }
        if (allowedRow) {
          await prisma.allowedTelegramUser.update({
            where: { id: allowedRow.id },
            data: {
              telegramId: tid,
              ...(normalizedUsername.length > 0 && allowedRow.username !== normalizedUsername
                ? { username: normalizedUsername }
                : {})
            }
          });
          await prisma.allowedTelegramUser.updateMany({
            where: { telegramId: tid, id: { not: allowedRow.id } },
            data: { telegramId: null }
          });
        }
      } catch (e) {
        console.warn("[createSessionResponseFromTgUser] allow telegramId sync:", e);
      }
    }

    const jwt = await signSessionToken(buildSessionPayload(user));
    const res = NextResponse.json({
      ok: true,
      role: user.role,
      onboardingRequired: !isProfileReady(user)
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
