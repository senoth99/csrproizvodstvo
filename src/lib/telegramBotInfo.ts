type TelegramApiOk<T> = { ok: true; result: T };
type TelegramApiErr = { ok: false; description?: string };

let cachedBotUsername: { value: string; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function fetchTelegramBotUsername(): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;

  if (cachedBotUsername && Date.now() - cachedBotUsername.at < CACHE_MS) {
    return cachedBotUsername.value;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { next: { revalidate: 0 } });
    const data = (await res.json()) as TelegramApiOk<{ username?: string }> | TelegramApiErr;
    if (!data.ok || !data.result?.username) return null;
    const username = data.result.username.toLowerCase();
    cachedBotUsername = { value: username, at: Date.now() };
    return username;
  } catch (e) {
    console.error("[fetchTelegramBotUsername]", e);
    return null;
  }
}

export type TelegramWebhookInfo = {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  ip_address?: string;
};

export async function fetchTelegramWebhookInfo(): Promise<TelegramWebhookInfo | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = (await res.json()) as TelegramApiOk<TelegramWebhookInfo> | TelegramApiErr;
    if (!data.ok) return null;
    return data.result;
  } catch (e) {
    console.error("[fetchTelegramWebhookInfo]", e);
    return null;
  }
}

/** Username из getMe (runtime) или fallback из NEXT_PUBLIC при сборке. */
export async function resolveTelegramBotUsername(): Promise<string | null> {
  const live = await fetchTelegramBotUsername();
  if (live) return live;
  const fromEnv = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "").trim().toLowerCase();
  return fromEnv || null;
}
