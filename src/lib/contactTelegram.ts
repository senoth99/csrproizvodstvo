/** Контакт для текста «обратитесь к…» (логины без @). */

export function getContactTelegramUsername(): string {
  const fromPublic = process.env.NEXT_PUBLIC_TELEGRAM_CONTACT?.replace(/^@/, "").trim();
  const fromEnv = process.env.TELEGRAM_ADMIN_USERNAME?.replace(/^@/, "").trim();
  return (fromPublic || fromEnv || "contact_voropaev").toLowerCase();
}
