import { randomBytes } from "node:crypto";

/** Параметр /start допускает только [A-Za-z0-9_] */
export function generateLoginLinkToken(): string {
  return randomBytes(16).toString("hex");
}

/** Достать токен из /start или из текста, если пользователь вставил токен сообщением */
export function extractTelegramLoginToken(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const startMatch = trimmed.match(/^\/start(?:@[A-Za-z\d_]+)?(?:\s+(.+))?$/);
  const fromCmd = startMatch?.[1]?.trim();
  if (fromCmd && /^[a-f\d]{32}$/i.test(fromCmd)) return fromCmd.toLowerCase();
  if (/^[a-f\d]{32}$/i.test(trimmed)) return trimmed.toLowerCase();
  // Backward compatibility for old tokens.
  if (fromCmd && /^login_[a-f\d]{32}$/i.test(fromCmd)) return fromCmd.slice(6).toLowerCase();
  if (/^login_[a-f\d]{32}$/i.test(trimmed)) return trimmed.slice(6).toLowerCase();
  return null;
}

export type TelegramInlineKeyboard = { text: string; callback_data: string }[][];

export async function telegramSendPhoto(
  chatId: number,
  photoBytes: Buffer,
  caption?: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append(
      "photo",
      new Blob([new Uint8Array(photoBytes)], { type: "image/jpeg" }),
      "workplace.jpg"
    );
    if (caption?.trim()) {
      form.append("caption", caption.trim().slice(0, 1024));
    }
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form
    });
  } catch {
    /* ignore */
  }
}

export async function telegramSendMessage(
  chatId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboard
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error("[telegramSendMessage] TELEGRAM_BOT_TOKEN не задан — ответ бота не отправлен");
    return;
  }
  try {
    const payload: Record<string, unknown> = { chat_id: chatId, text };
    if (replyMarkup?.length) {
      payload.reply_markup = { inline_keyboard: replyMarkup };
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[telegramSendMessage]", res.status, body.slice(0, 200));
    }
  } catch (e) {
    console.error("[telegramSendMessage]", e);
  }
}

/** Совместимо со старым именем использования */
export async function telegramSendMessageWithKeyboard(
  chatId: number,
  text: string,
  keyboard: TelegramInlineKeyboard
): Promise<void> {
  return telegramSendMessage(chatId, text, keyboard);
}

export async function telegramAnswerCallback(
  callbackQueryId: string,
  options?: { text?: string; show_alert?: boolean }
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const text = options?.text;
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: options?.show_alert ?? false
      })
    });
  } catch {
    /* ignore */
  }
}
