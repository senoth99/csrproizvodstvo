import { NextResponse } from "next/server";
import { UserRole } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  isSuperAdminPhone,
  isValidNormalizedPhone,
  normalizePhone,
  validatePasswordStrength
} from "@/lib/phoneAuth";
import { createSessionResponseFromPhoneUser, findUserByNormalizedPhone } from "@/lib/passwordAuthSignIn";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const phoneRaw =
      body && typeof body === "object" && "phone" in body && typeof (body as { phone: unknown }).phone === "string"
        ? (body as { phone: string }).phone
        : undefined;
    const password =
      body && typeof body === "object" && "password" in body && typeof (body as { password: unknown }).password === "string"
        ? (body as { password: string }).password
        : undefined;

    if (!phoneRaw?.trim() || !password) {
      return NextResponse.json({ error: "Укажите телефон и пароль" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phoneRaw);
    if (!isValidNormalizedPhone(normalizedPhone)) {
      return NextResponse.json({ error: "Некорректный номер телефона" }, { status: 400 });
    }

    const pwdError = validatePasswordStrength(password);
    if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 });

    const user = await findUserByNormalizedPhone(normalizedPhone);
    if (!user) {
      return NextResponse.json({ error: "Пользователь с таким телефоном не найден" }, { status: 404 });
    }

    if (user.passwordHash) {
      return NextResponse.json({ error: "Пароль уже задан. Войдите с паролем." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const superAdmin = isSuperAdminPhone(normalizedPhone);
    if (superAdmin) {
      const existingSuperAdmin = await prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN, id: { not: user.id } }
      });
      if (existingSuperAdmin) {
        return NextResponse.json({ error: "Суперадмин уже зарегистрирован" }, { status: 409 });
      }
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        phone: normalizedPhone,
        ...(superAdmin
          ? { role: UserRole.SUPER_ADMIN, approvalStatus: "APPROVED", isManager: false, isActive: true }
          : {})
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

    return createSessionResponseFromPhoneUser(updated);
  } catch (e) {
    console.error("[api/auth/set-password]", e);
    return NextResponse.json({ error: "Не удалось задать пароль. Попробуйте позже." }, { status: 503 });
  }
}
