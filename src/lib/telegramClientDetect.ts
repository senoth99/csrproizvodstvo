/** Обычный Chrome/Safari/Firefox — не Mini App; вход через бота и polling. */
export function isLikelyTelegramMiniAppHost(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Telegram/i.test(navigator.userAgent);
}
