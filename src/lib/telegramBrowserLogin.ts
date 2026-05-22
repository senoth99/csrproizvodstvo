/** Вход из обычного браузера: бот + webhook + challenge в БД. */
export function isBrowserTelegramLoginConfigured(): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const botUser = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "").trim();
  return Boolean(token && botUser);
}
