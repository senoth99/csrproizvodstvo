import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { extractTelegramLoginToken, telegramAnswerCallback, telegramSendMessage } from "@/lib/telegramBotHelpers";
import { getTelegramAllowanceRole, type TgMiniAppUser } from "@/lib/telegramSignIn";

type TgChat = { id: number };
type TgFrom = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};
type TelegramMessage = { chat: TgChat; from?: TgFrom; text?: string };
type TelegramCallbackQuery = {
  id: string;
  from?: TgFrom;
  data?: string;
};

let devWebhookSecretWarned = false;

async function handleLoginMessage(msg: TelegramMessage) {
  if (!msg.from) return false;

  const token = extractTelegramLoginToken(msg.text);
  if (!token) return false;

  const tokenHash = hashToken(token);
  const challenge = await prisma.telegramLoginChallenge.findUnique({ where: { tokenHash } });

  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    await telegramSendMessage(
      msg.chat.id,
      "Ссылка входа устарела или неверна. Обновите страницу на сайте и получите новый код."
    );
    return true;
  }

  if (challenge.status === "ready") {
    await telegramSendMessage(msg.chat.id, "Вход уже подтверждён — вернитесь в браузер.");
    return true;
  }

  const tgUser: TgMiniAppUser = {
    id: msg.from.id,
    username: msg.from.username,
    first_name: msg.from.first_name,
    last_name: msg.from.last_name
  };

  const role = await getTelegramAllowanceRole(tgUser);
  if (!role) {
    await prisma.telegramLoginChallenge.updateMany({
      where: { id: challenge.id, status: "pending" },
      data: { status: "denied" }
    });
    await telegramSendMessage(msg.chat.id, "Доступ не выдан. Обратитесь к администратору.");
    return true;
  }

  const updated = await prisma.telegramLoginChallenge.updateMany({
    where: { id: challenge.id, status: "pending" },
    data: {
      status: "ready",
      telegramId: String(msg.from.id),
      telegramUsername: msg.from.username ?? null,
      telegramFirstName: msg.from.first_name ?? null,
      telegramLastName: msg.from.last_name ?? null,
      telegramPhotoUrl: null
    }
  });

  if (updated.count !== 1) {
    await telegramSendMessage(msg.chat.id, "Вход уже подтверждён — вернитесь в браузер.");
    return true;
  }

  await telegramSendMessage(msg.chat.id, "Готово. Вернитесь в браузер — вход откроется автоматически.");
  return true;
}

async function handleCallbackQuery(cb: TelegramCallbackQuery) {
  await telegramAnswerCallback(cb.id, {
    text: "Это действие больше не поддерживается. Откройте приложение.",
    show_alert: true
  });
}

/** Входящие обновления от Bot API: вход по токену и ответы на callback-кнопки. */

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Задайте TELEGRAM_WEBHOOK_SECRET для webhook" }, { status: 503 });
    }
    if (!devWebhookSecretWarned) {
      console.warn("[api/telegram/webhook] TELEGRAM_WEBHOOK_SECRET не задан — запросы разрешены в dev");
      devWebhookSecretWarned = true;
    }
  } else if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let update: { message?: TelegramMessage; callback_query?: TelegramCallbackQuery };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    if (!msg?.chat?.id || !msg.from) {
      return NextResponse.json({ ok: true });
    }

    const text = msg.text?.trim() ?? "";
    const handled = await handleLoginMessage(msg);
    if (!handled) {
      if (/^\/start(?:@\w+)?$/i.test(text)) {
        const loginUrl = `${resolveAppPublicBaseUrl()}/telegram/login`;
        await telegramSendMessage(
          msg.chat.id,
          `Вход с сайта: откройте ${loginUrl} и нажмите «Открыть бота в Telegram». Обычный /start в чате вход не включает.`
        );
      } else if (text.startsWith("/")) {
        await telegramSendMessage(
          msg.chat.id,
          "Команда не распознана. Для входа используйте ссылку с сайта (раздел «Вход через Telegram»)."
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/telegram/webhook]", e);
    return NextResponse.json({ ok: true });
  }
}
