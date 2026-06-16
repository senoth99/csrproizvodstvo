import { NextResponse } from "next/server";
import { prisma, normalizeDatabaseUrlEnv } from "@/lib/prisma";
import { ACCESS_DENIED_CODE } from "@/lib/accessDenied";
import { buildSessionPayload, isProfileReady, signSessionToken, SESSION_TTL_SECONDS } from "@/lib/auth";
import { sessionCookieSecure } from "@/lib/sessionCookie";
import { shouldSkipApprovalCheck } from "@/lib/testMode";
import { normalizePhone } from "@/lib/phoneAuth";

type PhoneAuthUser = {
  id: string;
  name: string;
  role: string;
  isManager: boolean;
  profileCompleted: boolean;
  telegramUsername: string | null;
  isActive: boolean;
  approvalStatus: string;
  phone: string | null;
};

export async function createSessionResponseFromPhoneUser(
  user: PhoneAuthUser,
  options?: { pendingApproval?: boolean }
): Promise<NextResponse> {
  try {
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Доступ не выдан. Обратитесь к администратору.", code: ACCESS_DENIED_CODE },
        { status: 403 }
      );
    }

    if (user.approvalStatus === "REJECTED") {
      return NextResponse.json(
        { error: "Доступ не выдан. Обратитесь к администратору.", code: ACCESS_DENIED_CODE },
        { status: 403 }
      );
    }

    const pendingApproval =
      options?.pendingApproval ??
      (!shouldSkipApprovalCheck() && user.approvalStatus === "PENDING");

    const jwt = await signSessionToken(
      buildSessionPayload({
        id: user.id,
        role: user.role,
        isManager: user.isManager,
        profileCompleted: user.profileCompleted,
        telegramUsername: user.telegramUsername,
        name: user.name,
        phone: user.phone
      })
    );

    const res = NextResponse.json({
      ok: true,
      role: user.role,
      onboardingRequired: !isProfileReady(user),
      pendingApproval
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
    console.error("[createSessionResponseFromPhoneUser] DB или сессия:", e);
    const isSqlite = normalizeDatabaseUrlEnv(process.env.DATABASE_URL).startsWith("file:");
    const hint = isSqlite
      ? "Локальный SQLite: выполните npx prisma migrate deploy и при необходимости npm run prisma:seed."
      : "Проверьте DATABASE_URL и выполните npx prisma migrate deploy.";
    return NextResponse.json(
      { error: `База недоступна. ${hint}`, code: "SERVICE_UNAVAILABLE" },
      { status: 503 }
    );
  }
}

const phoneAuthUserSelect = {
  id: true,
  name: true,
  role: true,
  isManager: true,
  profileCompleted: true,
  telegramUsername: true,
  isActive: true,
  approvalStatus: true,
  passwordHash: true,
  phone: true
} as const;

async function findUserByNormalizedPhoneRaw(
  normalizedPhone: string,
  options?: { activeOnly?: boolean }
) {
  const activeOnly = options?.activeOnly ?? false;
  const activeFilter = activeOnly ? { isActive: true } : {};

  const direct = await prisma.user.findFirst({
    where: { phone: normalizedPhone, ...activeFilter },
    select: phoneAuthUserSelect
  });
  if (direct) return direct;

  const users = await prisma.user.findMany({
    where: { phone: { not: null }, ...activeFilter },
    select: phoneAuthUserSelect
  });
  return users.find((u) => u.phone && normalizePhone(u.phone) === normalizedPhone) ?? null;
}

/** Активный пользователь по нормализованному телефону (login / set-password). */
export async function findUserByNormalizedPhone(normalizedPhone: string) {
  return findUserByNormalizedPhoneRaw(normalizedPhone, { activeOnly: true });
}

/** Любой пользователь по телефону — для повторной регистрации после отклонения. */
export async function findUserByNormalizedPhoneAnyStatus(normalizedPhone: string) {
  return findUserByNormalizedPhoneRaw(normalizedPhone);
}
