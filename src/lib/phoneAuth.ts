import bcrypt from "bcryptjs";
import { normalizePhoneInput } from "@/lib/formatPhone";

const BCRYPT_ROUNDS = 12;

/**
 * Нормализация телефона для хранения и поиска: только цифры, RU (+7/8 → 7XXXXXXXXXX).
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return digits;
  if (digits.length === 10) return `7${digits}`;
  if (digits.startsWith("7") && digits.length > 11) return digits.slice(0, 11);
  return digits;
}

/** Совместимость с профилем (+7…) и auth (цифры). */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return normalizePhone(a) === normalizePhone(b);
}

export function isValidNormalizedPhone(phone: string): boolean {
  return /^7\d{10}$/.test(normalizePhone(phone));
}

/** Для отображения и welcome-формы — +7XXXXXXXXXX. */
export function phoneToDisplayFormat(phone: string): string {
  const n = normalizePhone(phone);
  if (/^7\d{10}$/.test(n)) return `+${n}`;
  return normalizePhoneInput(phone);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Пароль должен быть не короче 8 символов";
  return null;
}

/** Нормализованный телефон суперадмина из SUPER_ADMIN_PHONE (7XXXXXXXXXX) или null. */
export function normalizedSuperAdminPhone(): string | null {
  const raw = process.env.SUPER_ADMIN_PHONE?.trim();
  if (!raw) return null;
  const n = normalizePhone(raw);
  return /^7\d{10}$/.test(n) ? n : null;
}

export function isSuperAdminPhone(phone: string): boolean {
  const configured = normalizedSuperAdminPhone();
  if (!configured) return false;
  return normalizePhone(phone) === configured;
}
