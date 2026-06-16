import { NextResponse } from "next/server";
import { UserRole } from "@/lib/enums";
import { notifyAdminRoleUsers } from "@/lib/notifyAdmins";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  isSuperAdminPhone,
  isValidNormalizedPhone,
  normalizePhone,
  phonesMatch,
  validatePasswordStrength
} from "@/lib/phoneAuth";
import { createSessionResponseFromPhoneUser, findUserByNormalizedPhoneAnyStatus } from "@/lib/passwordAuthSignIn";
import { resolveRegistrationApprovalStatus } from "@/lib/testMode";
import { assertTelegramUsernameFree, normalizeTelegramUsername, validateTelegramUsername } from "@/lib/telegramUsername";
import { z } from "zod";

const registerBodySchema = z.object({
  phone: z.string().trim().min(1),
  password: z.string().min(1),
  firstName: z.string().trim().min(2, "Имя минимум 2 символа"),
  lastName: z.string().trim().min(2, "Фамилия минимум 2 символа"),
  telegramUsername: z.string().optional().default("")
});

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = registerBodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Проверьте введённые данные";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { phone: phoneRaw, password, firstName, lastName, telegramUsername: telegramRaw } = parsed.data;

    if (!phoneRaw || !password) {
      return NextResponse.json({ error: "Укажите телефон и пароль" }, { status: 400 });
    }

    const telegramUsername = normalizeTelegramUsername(telegramRaw ?? "");
    const telegramError = validateTelegramUsername(telegramUsername);
    if (telegramError) {
      return NextResponse.json({ error: telegramError }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phoneRaw);
    if (!isValidNormalizedPhone(normalizedPhone)) {
      return NextResponse.json({ error: "Некорректный номер телефона" }, { status: 400 });
    }

    const pwdError = validatePasswordStrength(password);
    if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 });

    const approvalStatus = isSuperAdminPhone(normalizedPhone)
      ? "APPROVED"
      : resolveRegistrationApprovalStatus();
    const role = isSuperAdminPhone(normalizedPhone) ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE;
    if (role === UserRole.SUPER_ADMIN) {
      const existingSuperAdmin = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
      if (existingSuperAdmin && !phonesMatch(existingSuperAdmin.phone, normalizedPhone)) {
        return NextResponse.json({ error: "Суперадмин уже зарегистрирован" }, { status: 409 });
      }
    }
    const passwordHash = await hashPassword(password);
    const displayName = `${lastName} ${firstName}`.trim();

    const existing = await findUserByNormalizedPhoneAnyStatus(normalizedPhone);
    if (existing) {
      if (existing.approvalStatus !== "REJECTED" && existing.isActive) {
        return NextResponse.json({ error: "Пользователь с таким телефоном уже зарегистрирован" }, { status: 409 });
      }

      try {
        await assertTelegramUsernameFree(telegramUsername, existing.id);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Этот Telegram username уже занят" },
          { status: 409 }
        );
      }

      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: displayName,
          firstName,
          lastName,
          phone: normalizedPhone,
          passwordHash,
          approvalStatus,
          role: isSuperAdminPhone(normalizedPhone) ? UserRole.SUPER_ADMIN : existing.role,
          isActive: true,
          profileCompleted: true,
          telegramUsername: telegramUsername || null,
          ...(isSuperAdminPhone(normalizedPhone) ? { isManager: false } : {})
        },
        select: {
          id: true,
          name: true,
          role: true,
          isManager: true,
          profileCompleted: true,
          telegramUsername: true,
          isActive: true,
          approvalStatus: true,
          phone: true
        }
      });

      if (approvalStatus === "PENDING") {
        await notifyAdminRoleUsers({
          type: "USER_REGISTRATION_PENDING",
          title: "Новая регистрация",
          body: `${displayName}, тел. +${normalizedPhone} — ожидает одобрения`,
          pushUrl: "/admin/users"
        }).catch((e) => console.warn("[api/auth/register] notify admins:", e));
      }

      return createSessionResponseFromPhoneUser(user, {
        pendingApproval: approvalStatus === "PENDING"
      });
    }

    try {
      await assertTelegramUsernameFree(telegramUsername);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Этот Telegram username уже занят" },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name: displayName,
        firstName,
        lastName,
        phone: normalizedPhone,
        passwordHash,
        approvalStatus,
        role,
        isActive: true,
        profileCompleted: true,
        telegramUsername: telegramUsername || null,
        ...(role === UserRole.SUPER_ADMIN ? { isManager: false } : {})
      },
      select: {
        id: true,
        name: true,
        role: true,
        isManager: true,
        profileCompleted: true,
        telegramUsername: true,
        isActive: true,
        approvalStatus: true,
        phone: true
      }
    });

    if (approvalStatus === "PENDING") {
      await notifyAdminRoleUsers({
        type: "USER_REGISTRATION_PENDING",
        title: "Новая регистрация",
        body: `${displayName}, тел. +${normalizedPhone} — ожидает одобрения`,
        pushUrl: "/admin/users"
      }).catch((e) => console.warn("[api/auth/register] notify admins:", e));
    }

    return createSessionResponseFromPhoneUser(user, {
      pendingApproval: approvalStatus === "PENDING"
    });
  } catch (e) {
    console.error("[api/auth/register]", e);
    return NextResponse.json({ error: "Ошибка регистрации. Попробуйте позже." }, { status: 503 });
  }
}
