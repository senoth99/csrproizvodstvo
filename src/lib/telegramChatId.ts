import { prisma } from "@/lib/prisma";

/** Chat id для Telegram: User.telegramId или fallback из AllowedTelegramUser по username. */
export async function resolveUserTelegramChatId(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true, telegramUsername: true }
  });
  if (!user) return null;

  const fromUser = parseTelegramChatId(user.telegramId);
  if (fromUser != null) return fromUser;

  const username = user.telegramUsername?.trim().toLowerCase().replace(/^@/, "");
  if (!username) return null;

  const allowed = await prisma.allowedTelegramUser.findUnique({
    where: { username },
    select: { telegramId: true }
  });
  const fromAllowlist = parseTelegramChatId(allowed?.telegramId);
  if (fromAllowlist == null) return null;

  await prisma.user
    .update({
      where: { id: userId },
      data: { telegramId: String(fromAllowlist) }
    })
    .catch(() => {});

  return fromAllowlist;
}

function parseTelegramChatId(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
