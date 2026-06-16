/**
 * Однократная миграция существующих пользователей на phone/password auth.
 * Запуск: npx tsx scripts/migrate-existing-users.ts
 */
import { PrismaClient } from "@prisma/client";
import { normalizePhone } from "../src/lib/phoneAuth";

const prisma = new PrismaClient();

function normalizeStoredPhone(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  try {
    const n = normalizePhone(raw);
    return /^7\d{10}$/.test(n) ? n : null;
  } catch {
    return null;
  }
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, phone: true, isActive: true, approvalStatus: true }
  });

  let phonesNormalized = 0;
  let approved = 0;

  for (const user of users) {
    const normalized = normalizeStoredPhone(user.phone);
    const updates: { phone?: string; approvalStatus?: string } = {};

    if (normalized && normalized !== user.phone) {
      updates.phone = normalized;
      phonesNormalized++;
    }

    if (user.isActive && user.approvalStatus !== "APPROVED") {
      updates.approvalStatus = "APPROVED";
      approved++;
    }

    if (Object.keys(updates).length > 0) {
      try {
        await prisma.user.update({ where: { id: user.id }, data: updates });
      } catch (e) {
        console.warn(`Skip user ${user.id}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  console.log(`Done. Phones normalized: ${phonesNormalized}, set APPROVED: ${approved}, total users: ${users.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
