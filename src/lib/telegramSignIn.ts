import { NextResponse } from "next/server";
import { prisma, normalizeDatabaseUrlEnv } from "@/lib/prisma";
import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums";
import { ACCESS_DENIED_CODE } from "@/lib/accessDenied";
import { buildSessionPayload, isProfileReady, signSessionToken, SESSION_TTL_SECONDS } from "@/lib/auth";
import { sessionCookieSecure } from "@/lib/sessionCookie";
import { shouldSkipApprovalCheck } from "@/lib/testMode";

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
  userId: string | null;
};

function superAdminEnvFallback(tgUser: TgMiniAppUser): boolean {
  const rawAdminUser = process.env.TELEGRAM_ADMIN_USERNAME?.trim();
  const adminUsername =
    rawAdminUser && rawAdminUser.length > 0 ? rawAdminUser.replace(/^@+/, "").toLowerCase() : null;
  const adminTgId = process.env.TELEGRAM_ADMIN_TELEGRAM_ID?.trim();
  const normalizedUsername = (tgUser.username ?? "").toLowerCase();
  const fallbackByUsername =
    adminUsername !== null && normalizedUsername.length > 0 && normalizedUsername === adminUsername;
  const fallbackById = Boolean(adminTgId && String(tgUser.id) === adminTgId);
  return fallbackByUsername || fallbackById;
}

async function findApprovedUserForTelegram(tgUser: TgMiniAppUser) {
  const normalizedUsername = (tgUser.username ?? "").toLowerCase();
  const tid = String(tgUser.id);
  const approvalFilter = shouldSkipApprovalCheck() ? {} : { approvalStatus: "APPROVED" as const };

  const byTgId = await prisma.user.findFirst({
    where: { telegramId: tid, isActive: true, ...approvalFilter },
    select: { id: true, role: true, isManager: true }
  });
  if (byTgId) return byTgId;

  if (normalizedUsername.length > 0) {
    return prisma.user.findFirst({
      where: { telegramUsername: normalizedUsername, isActive: true, ...approvalFilter },
      select: { id: true, role: true, isManager: true }
    });
  }

  return null;
}

export async function resolveTelegramAllowance(tgUser: TgMiniAppUser): Promise<TelegramAllowance | null> {
  if (superAdminEnvFallback(tgUser)) {
    return { role: UserRole.SUPER_ADMIN, isManager: false, userId: null };
  }

  const user = await findApprovedUserForTelegram(tgUser);
  if (!user) return null;

  const role = user.role as UserRoleValue;
  if (role !== UserRole.EMPLOYEE && role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
    return null;
  }

  return {
    role,
    isManager: user.isManager,
    userId: user.id
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
        { error: "Доступ не выдан. Дождитесь одобрения регистрации.", code: ACCESS_DENIED_CODE },
        { status: 403 }
      );
    }
    const displayName =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim() || `tg_${tgUser.id}`;

    const normalizedUsername = (tgUser.username ?? "").toLowerCase();
    const tid = String(tgUser.id);
    let isManagerFlag = false;
    if (options?.forcedRole) {
      const prev = await prisma.user.findUnique({ where: { telegramId: tid } });
      isManagerFlag = prev?.isManager ?? false;
    } else {
      isManagerFlag = allowance?.isManager ?? false;
    }

    let user;
    if (allowance?.userId) {
      user = await prisma.user.update({
        where: { id: allowance.userId },
        data: {
          telegramId: tid,
          telegramUsername: normalizedUsername.length > 0 ? normalizedUsername : null,
          telegramPhotoUrl: tgUser.photo_url ?? null,
          role,
          isManager: isManagerFlag
        }
      });
    } else {
      user = await prisma.user.upsert({
        where: { telegramId: tid },
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
          telegramId: tid,
          telegramUsername: normalizedUsername.length > 0 ? normalizedUsername : null,
          telegramPhotoUrl: tgUser.photo_url ?? null,
          firstName: tgUser.first_name ?? null,
          lastName: tgUser.last_name ?? null,
          name: displayName,
          role,
          isActive: true,
          profileCompleted: false,
          isManager: isManagerFlag,
          approvalStatus: role === UserRole.SUPER_ADMIN ? "APPROVED" : "PENDING"
        }
      });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Доступ не выдан. Обратитесь к администратору.", code: ACCESS_DENIED_CODE },
        { status: 403 }
      );
    }

    if (!shouldSkipApprovalCheck() && user.approvalStatus === "PENDING") {
      return NextResponse.json(
        { error: "Регистрация ожидает одобрения.", code: ACCESS_DENIED_CODE },
        { status: 403 }
      );
    }

    if (user.approvalStatus === "REJECTED") {
      return NextResponse.json(
        { error: "Доступ не выдан. Обратитесь к администратору.", code: ACCESS_DENIED_CODE },
        { status: 403 }
      );
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
