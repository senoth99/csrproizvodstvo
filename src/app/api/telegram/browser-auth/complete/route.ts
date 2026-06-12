import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { createSessionResponseFromTgUser, type TgMiniAppUser } from "@/lib/telegramSignIn";
import { isBrowserTelegramLoginConfigured } from "@/lib/telegramBrowserLogin";

export async function POST(req: Request) {
  if (!isBrowserTelegramLoginConfigured()) {
    return NextResponse.json(
      { error: "Вход из браузера не настроен. Задайте TELEGRAM_BOT_TOKEN и NEXT_PUBLIC_TELEGRAM_BOT_USERNAME." },
      { status: 503 }
    );
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
    const now = new Date();

    const consumeResult = await prisma.$transaction(async (tx) => {
      const row = await tx.telegramLoginChallenge.findUnique({ where: { tokenHash } });
      if (!row) return { kind: "waiting" as const };
      if (row.expiresAt.getTime() < now.getTime()) {
        await tx.telegramLoginChallenge.delete({ where: { id: row.id } }).catch(() => {});
        return { kind: "expired" as const };
      }
      if (row.status !== "ready" || !row.telegramId) return { kind: "waiting" as const };

      const tgUser: TgMiniAppUser = {
        id: Number(row.telegramId),
        username: row.telegramUsername ?? undefined,
        first_name: row.telegramFirstName ?? undefined,
        last_name: row.telegramLastName ?? undefined,
        photo_url: row.telegramPhotoUrl ?? undefined
      };
      if (!Number.isFinite(tgUser.id)) {
        await tx.telegramLoginChallenge.delete({ where: { id: row.id } }).catch(() => {});
        return { kind: "invalid_user" as const };
      }

      const consumed = await tx.telegramLoginChallenge.deleteMany({
        where: {
          id: row.id,
          status: "ready",
          telegramId: { not: null },
          expiresAt: { gt: now }
        }
      });
      if (consumed.count !== 1) return { kind: "waiting" as const };

      return { kind: "ok" as const, tgUser };
    });

    if (consumeResult.kind === "waiting") {
      return NextResponse.json({ waiting: true }, { status: 202 });
    }
    if (consumeResult.kind === "expired") {
      return NextResponse.json({ error: "Токен устарел. Запросите новый на странице входа." }, { status: 410 });
    }
    if (consumeResult.kind === "invalid_user") {
      return NextResponse.json({ error: "Некорректные данные пользователя в записи входа" }, { status: 400 });
    }

    return await createSessionResponseFromTgUser(consumeResult.tgUser);
  } catch (e) {
    console.error("[api/telegram/browser-auth/complete]", e);
    return NextResponse.json({ error: "База или сессия недоступны. Выполните prisma db push / migrate и перезапустите сервер." }, { status: 503 });
  }
}
