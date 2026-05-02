import { existsSync, mkdirSync } from "fs";
import { dirname, isAbsolute, join, normalize } from "path";
import { pathToFileURL } from "url";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrlEnv as normalizeDbUrlFromEnv } from "@/lib/envNormalize";

export { normalizeDatabaseUrlEnv } from "@/lib/envNormalize";

/**
 * Относительные file:‑URL вида file:./dev.db в Prisma обычно считаются от папки schema.
 * При dev‑сервера Next cwd иногда не совпадает с ожидаемым — база «не находится» → сырой HTML 500 без JSON на API.
 * Фиксируем на абсолютный file‑URL около prisma/<имя файла>.
 */

function resolveDatasourceUrl(): string | undefined {
  try {
    const raw = normalizeDbUrlFromEnv(process.env.DATABASE_URL);
    if (!raw) return pathToFileURL(join(process.cwd(), "prisma", "dev.db")).href;
    if (!raw.startsWith("file:")) return raw;

    let inner = raw.slice("file:".length).trim();
    try {
      inner = decodeURIComponent(inner);
    } catch {
      /* оставить как есть */
    }
    inner = normalize(inner);

    /* file::memory:?cache=shared и т.п. не трогаем */
    if (/^:memory:?/i.test(inner) || inner.includes(":memory:")) {
      return raw;
    }

    let fsPath: string;
    if (isAbsolute(inner)) {
      fsPath = inner;
    } else {
      const rel = inner.replace(/^\.(?:[/\\])+/, "");
      const dotted = [...Array(9)].map((_, up) =>
        join(process.cwd(), ...Array(up).fill(".."), "prisma", rel)
      );
      fsPath =
        dotted.find((p) => existsSync(p)) ??
        join(process.cwd(), "prisma", rel);
    }
    try {
      mkdirSync(dirname(fsPath), { recursive: true });
    } catch {
      /* файл может уже быть; mkdir не критичен */
    }
    return pathToFileURL(fsPath).href;
  } catch (e) {
    console.error("[prisma] resolveDatasourceUrl", e);
    return pathToFileURL(join(process.cwd(), "prisma", "dev.db")).href;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = resolveDatasourceUrl();

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: ["error", "warn"]
  });
}

export const prisma = globalForPrisma.prisma;
