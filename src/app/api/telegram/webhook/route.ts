import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { extractTelegramLoginToken, telegramAnswerCallback, telegramSendMessage } from "@/lib/telegramBotHelpers";
import { respondToShiftSwapRequest } from "@/lib/shiftSwapCore";
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

async function handleLoginMessage(msg: TelegramMessage) {
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
    id: msg.from!.id,
    username: msg.from!.username,
    first_name: msg.from!.first_name,
    last_name: msg.from!.last_name
  };

  const role = await getTelegramAllowanceRole(tgUser);
  if (!role) {
    await telegramSendMessage(msg.chat.id, "Доступ не выдан. Обратитесь к администратору.");
    return true;
  }

  await prisma.telegramLoginChallenge.update({
    where: { id: challenge.id },
    data: {
      status: "ready",
      telegramId: String(msg.from!.id),
      telegramUsername: msg.from!.username ?? null,
      telegramFirstName: msg.from!.first_name ?? null,
      telegramLastName: msg.from!.last_name ?? null,
      telegramPhotoUrl: null
    }
  });

  await telegramSendMessage(msg.chat.id, "Готово. Вернитесь в браузер — вход откроется автоматически.");
  return true;
}

async function handleSwapCallback(cb: TelegramCallbackQuery) {
  const cqId = cb.id;
  const data = (cb.data ?? "").trim();
  const acc = /^swap_acc:(.+)$/.exec(data);
  const dec = /^swap_dec:(.+)$/.exec(data);
  if (!cb.from?.id || (!acc?.[1] && !dec?.[1])) {
    await telegramAnswerCallback(cqId, {
      text: "Неизвестная команда",
      show_alert: true
    });
    return;
  }

  const requestId = (acc?.[1] ?? dec?.[1])!;
  const accept = Boolean(acc);

  const user = await prisma.user.findFirst({
    where: { telegramId: String(cb.from.id), isActive: true }
  });

  if (!user) {
    await telegramAnswerCallback(cqId, {
      text: "Профиль не найден — войдите в приложение хотя бы раз.",
      show_alert: true
    });
    return;
  }

  const result = await respondToShiftSwapRequest(requestId, accept, user.id);
  if (!result.ok) {
    await telegramAnswerCallback(cqId, {
      text: result.message.slice(0, 180),
      show_alert: true
    });
    return;
  }

  await telegramAnswerCallback(cqId, {
    text: accept ? "Обмен подтверждён." : "Запрос отклонён."
  });
}

/** Входящие обновления от Bot API: вход по токену и кнопки обмена сменами */

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Задайте TELEGRAM_WEBHOOK_SECRET для webhook" }, { status: 503 });
  }

  let update: { message?: TelegramMessage; callback_query?: TelegramCallbackQuery };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    if (update.callback_query) {
      await handleSwapCallback(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    if (!msg?.chat?.id || !msg.from) {
      return NextResponse.json({ ok: true });
    }

    await handleLoginMessage(msg);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/telegram/webhook]", e);
    return NextResponse.json({ ok: true });
  }
}
