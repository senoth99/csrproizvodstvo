import { prisma } from "@/lib/prisma";
import { telegramSendMessage } from "@/lib/telegramBotHelpers";

/** Запись в колокольчике приложения (без Telegram). */
export async function insertAppNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: unknown;
  swapRequestId?: string | null;
}) {
  try {
    await prisma.appNotification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload != null ? JSON.stringify(input.payload) : null,
        swapRequestId: input.swapRequestId ?? null
      }
    });
  } catch (e) {
    console.error(
      "[insertAppNotification] Не удалось записать уведомление. Выполните `npx prisma generate` и примените схему к БД.",
      e
    );
  }
}

/**
 * Колокольчик + обычное текстовое сообщение в Telegram (если у пользователя есть telegramId и задан TELEGRAM_BOT_TOKEN).
 */
export async function notifyUserAppAndTelegram(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: unknown;
  swapRequestId?: string | null;
  /** Не слать TG (например, если отдельно уходит сообщение с кнопками). */
  skipTelegram?: boolean;
  /** Полный текст в Telegram (по умолчанию: заголовок + пустая строка + текст). */
  telegramText?: string;
}) {
  try {
    await insertAppNotification({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
      swapRequestId: input.swapRequestId ?? null
    });

    if (input.skipTelegram) return;

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { telegramId: true }
    });
    const raw = user?.telegramId;
    const chatId = raw != null && raw !== "" ? Number(raw) : NaN;
    if (!Number.isFinite(chatId)) return;

    const text =
      input.telegramText ?? `${input.title}\n\n${input.body}`.trim();
    await telegramSendMessage(chatId, text.slice(0, 4090));
  } catch (e) {
    console.error("[notifyUserAppAndTelegram]", input.type, e);
  }
}
