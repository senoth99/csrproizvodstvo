/** Нормализация ввода телефона (RU): храним в виде +7XXXXXXXXXX. */
export function normalizePhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return raw.trim();
}

export function isValidPhone(raw: string): boolean {
  const normalized = normalizePhoneInput(raw);
  return /^\+7\d{10}$/.test(normalized);
}

/** +79991234567 → +7 999 123-45-67 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone?.trim()) return "—";
  const normalized = normalizePhoneInput(phone);
  const m = normalized.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}`;
  return phone.trim();
}
