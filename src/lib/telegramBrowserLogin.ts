/** Вход из обычного браузера: бот + webhook + challenge в БД. Username берётся из getMe в start. */
export function isBrowserTelegramLoginConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}
