import { NextResponse } from "next/server";
import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums";
import { createSessionResponseFromTgUser } from "@/lib/telegramSignIn";

export const runtime = "nodejs";

/** Локальный вход без бота: TELEGRAM_ALLOW_DEV_LOGIN=true; не выключаем на localhost/`next start` по NODE_ENV, только на Vercel. */

function resolveDevRole(): UserRoleValue {
  const raw = process.env.TELEGRAM_DEV_ROLE?.trim()?.toUpperCase();
  if (raw === UserRole.SUPER_ADMIN || raw === UserRole.ADMIN || raw === UserRole.EMPLOYEE) return raw;
  return UserRole.SUPER_ADMIN;
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev-вход отключён в production." }, { status: 403 });
  }

  if (process.env.VERCEL) {
    return NextResponse.json({ error: "Dev-вход отключён при деплое на Vercel" }, { status: 403 });
  }

  if (process.env.TELEGRAM_ALLOW_DEV_LOGIN !== "true") {
    return NextResponse.json(
      {
        error: "Включите TELEGRAM_ALLOW_DEV_LOGIN=true в .env (только development)."
      },
      { status: 403 }
    );
  }

  try {
    const idRaw = process.env.TELEGRAM_DEV_TELEGRAM_ID?.trim() ?? "918273645";
    const id = Number(idRaw);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Некорректный TELEGRAM_DEV_TELEGRAM_ID" }, { status: 400 });
    }

    const usernameRaw = process.env.TELEGRAM_DEV_USERNAME?.replace(/^@/, "").trim() || undefined;
    const firstName = process.env.TELEGRAM_DEV_FIRST_NAME?.trim() || "Dev";
    const lastName = process.env.TELEGRAM_DEV_LAST_NAME?.trim() || "Tester";
    const forcedRole = resolveDevRole();

    return await createSessionResponseFromTgUser(
      {
        id,
        username: usernameRaw,
        first_name: firstName,
        last_name: lastName
      },
      { forcedRole }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dev-session]", msg);
    return NextResponse.json(
      {
        error: msg.includes("Unique constraint")
          ? "Конфликт записи пользователя — смените TELEGRAM_DEV_TELEGRAM_ID."
          : `Ошибка сервера: ${msg}`,
        hint: "Если упоминается код Prisma или БД — выполните: npx prisma db push и перезапустите next dev."
      },
      { status: 503 }
    );
  }
}
