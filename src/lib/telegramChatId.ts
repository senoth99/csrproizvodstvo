import { prisma } from "@/lib/prisma";

/** Chat id для Telegram push — из профиля пользователя после входа через Telegram. */
export async function resolveUserTelegramChatId(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true }
  });
  if (!user) return null;
  return parseTelegramChatId(user.telegramId);
}

function parseTelegramChatId(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
