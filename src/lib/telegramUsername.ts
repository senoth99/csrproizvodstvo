import { prisma } from "@/lib/prisma";

/** Без ведущих @, lower-case; пустая строка — username не указан. */
export function normalizeTelegramUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function validateTelegramUsername(normalized: string): string | null {
  if (!normalized) return null;
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(normalized)) {
    return "Username Telegram: 5–32 символа, латиница, цифры и _";
  }
  return null;
}

export async function assertTelegramUsernameFree(normalized: string, excludeUserId?: string): Promise<void> {
  if (!normalized) return;
  const existing = await prisma.user.findFirst({
    where: {
      telegramUsername: normalized,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {})
    },
    select: { id: true }
  });
  if (existing) {
    throw new Error("Этот Telegram username уже занят");
  }
}
