import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { createSessionResponseFromTgUser, type TgMiniAppUser } from "@/lib/telegramSignIn";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Вход только через Telegram Mini App." }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Неверное тело запроса (ожидается JSON)" }, { status: 400 });
    }
    const tokenRaw = typeof body.token === "string" ? body.token.trim().toLowerCase() : "";

    const normalizedToken = tokenRaw.startsWith("login_") ? tokenRaw.slice("login_".length) : tokenRaw;
    if (!/^[a-f\d]{32}$/.test(normalizedToken)) {
      return NextResponse.json({ error: "Неверный формат токена" }, { status: 400 });
    }

    const tokenHash = hashToken(normalizedToken);
    const row = await prisma.telegramLoginChallenge.findUnique({ where: { tokenHash } });

    if (!row) {
      return NextResponse.json({ waiting: true }, { status: 202 });
    }

    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.telegramLoginChallenge.delete({ where: { id: row.id } }).catch(() => {});
      return NextResponse.json({ error: "Токен устарел. Запросите новый на странице входа." }, { status: 410 });
    }

    if (row.status !== "ready" || !row.telegramId) {
      return NextResponse.json({ waiting: true }, { status: 202 });
    }

    const tgUser: TgMiniAppUser = {
      id: Number(row.telegramId),
      username: row.telegramUsername ?? undefined,
      first_name: row.telegramFirstName ?? undefined,
      last_name: row.telegramLastName ?? undefined,
      photo_url: row.telegramPhotoUrl ?? undefined
    };
    if (!Number.isFinite(tgUser.id)) {
      await prisma.telegramLoginChallenge.delete({ where: { id: row.id } }).catch(() => {});
      return NextResponse.json({ error: "Некорректные данные пользователя в записи входа" }, { status: 400 });
    }

    const sessionRes = await createSessionResponseFromTgUser(tgUser);
    await prisma.telegramLoginChallenge.delete({ where: { id: row.id } }).catch(() => {});
    return sessionRes;
  } catch (e) {
    console.error("[api/telegram/browser-auth/complete]", e);
    return NextResponse.json({ error: "База или сессия недоступны. Выполните prisma db push / migrate и перезапустите сервер." }, { status: 503 });
  }
}
