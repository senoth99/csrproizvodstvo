/** Контакт для текста «обратитесь к…» (логины без @). Пустая строка — контакт не настроен. */

export function getContactTelegramUsername(): string {
  const fromPublic = process.env.NEXT_PUBLIC_TELEGRAM_CONTACT?.replace(/^@/, "").trim();
  const fromEnv = process.env.TELEGRAM_ADMIN_USERNAME?.replace(/^@/, "").trim();
  return (fromPublic || fromEnv || "").toLowerCase();
}

export function getContactTelegramUrl(): string | null {
  const handle = getContactTelegramUsername();
  return handle.length > 0 ? `https://t.me/${encodeURIComponent(handle)}` : null;
}
