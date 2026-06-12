import { randomBytes } from "node:crypto";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { prisma } from "@/lib/prisma";

export const WORKPLACE_QR_TOKEN_KEY = "workplace_qr_token";

/** Стабильный токен QR в SystemSettings; при отсутствии создаётся 32 hex-символа. */
export async function getOrCreateWorkplaceQrToken(): Promise<string> {
  const existing = await prisma.systemSettings.findUnique({
    where: { key: WORKPLACE_QR_TOKEN_KEY },
    select: { value: true }
  });
  if (existing?.value?.trim()) return existing.value.trim();

  const token = randomBytes(16).toString("hex");
  await prisma.systemSettings.upsert({
    where: { key: WORKPLACE_QR_TOKEN_KEY },
    create: { key: WORKPLACE_QR_TOKEN_KEY, value: token },
    update: {}
  });

  const row = await prisma.systemSettings.findUnique({
    where: { key: WORKPLACE_QR_TOKEN_KEY },
    select: { value: true }
  });
  const value = row?.value?.trim();
  if (!value) throw new Error("workplace QR token missing after upsert");
  return value;
}

export function getWorkplaceCheckInUrl(token: string): string {
  const base = resolveAppPublicBaseUrl();
  return `${base}/check-in?k=${encodeURIComponent(token)}`;
}
