import { NextResponse } from "next/server";
import { UserRole } from "@/lib/enums";
import { ACCESS_DENIED_CODE } from "@/lib/accessDenied";
import {
  isSuperAdminPhone,
  isValidNormalizedPhone,
  normalizePhone,
  verifyPassword
} from "@/lib/phoneAuth";
import { createSessionResponseFromPhoneUser, findUserByNormalizedPhone } from "@/lib/passwordAuthSignIn";
import { prisma } from "@/lib/prisma";

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

    const user = await findUserByNormalizedPhone(normalizedPhone);
    if (!user) {
      return NextResponse.json({ error: "Неверный телефон или пароль" }, { status: 401 });
    }

    if (!user.passwordHash) {
      if (user.approvalStatus === "REJECTED" || !user.isActive) {
        return NextResponse.json(
          { error: "Доступ не выдан. Обратитесь к администратору.", code: ACCESS_DENIED_CODE },
          { status: 403 }
        );
      }
      return NextResponse.json({
        ok: false,
        needsPassword: true,
        message: "Для этого аккаунта нужно задать пароль"
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Неверный телефон или пароль" }, { status: 401 });
    }

    if (isSuperAdminPhone(normalizedPhone) && user.role !== UserRole.SUPER_ADMIN) {
      const existingSuperAdmin = await prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN, id: { not: user.id } }
      });
      if (existingSuperAdmin) {
        return NextResponse.json({ error: "Суперадмин уже зарегистрирован" }, { status: 409 });
      }
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: UserRole.SUPER_ADMIN,
          approvalStatus: "APPROVED",
          isManager: false,
          isActive: true
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
    }

    return createSessionResponseFromPhoneUser(user);
  } catch (e) {
    console.error("[api/auth/login]", e);
    return NextResponse.json({ error: "Ошибка входа. Попробуйте позже." }, { status: 503 });
  }
}
