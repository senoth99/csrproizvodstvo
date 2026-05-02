import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma, normalizeDatabaseUrlEnv } from "@/lib/prisma";
import { generateLoginLinkToken } from "@/lib/telegramBotHelpers";

const TTL_MINUTES = 15;

export async function POST() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const botUser = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "").trim();
  const devBypass =
    process.env.NODE_ENV !== "production" && process.env.TELEGRAM_ALLOW_DEV_LOGIN === "true";

  if ((!botToken || !botUser) && !devBypass) {
    return NextResponse.json(
      { error: "Не заданы TELEGRAM_BOT_TOKEN или NEXT_PUBLIC_TELEGRAM_BOT_USERNAME" },
      { status: 503 }
    );
  }

  try {
    await prisma.telegramLoginChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    }).catch(() => {});

    const raw = generateLoginLinkToken().toLowerCase();
    const tokenHash = hashToken(raw);
    const expiresAt = addMinutes(new Date(), TTL_MINUTES);
    await prisma.telegramLoginChallenge.create({
      data: { tokenHash, expiresAt }
    });

    const hasBotDeepLink = Boolean(botToken && botUser);
    const openUrl = hasBotDeepLink
      ? `https://t.me/${encodeURIComponent(botUser)}?start=${encodeURIComponent(raw)}`
      : null;

    return NextResponse.json({
      token: raw,
      openUrl,
      expiresInSec: TTL_MINUTES * 60,
      botUsername: botUser || null,
      devModeNoBot: !hasBotDeepLink
    });
  } catch (e) {
    console.error("[api/telegram/browser-auth/start] база недоступна или схема не применена:", e);
    const isSqlite = normalizeDatabaseUrlEnv(process.env.DATABASE_URL).startsWith("file:");
    return NextResponse.json(
      {
        error: isSqlite
          ? "База недоступна. Выполните: npx prisma db push и проверьте DATABASE_URL=file:./dev.db (SQLite в папке prisma/)."
          : "База недоступна. Выполните: npx prisma migrate deploy или db push и проверьте DATABASE_URL."
      },
      { status: 503 }
    );
  }

}
