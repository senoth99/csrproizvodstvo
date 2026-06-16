let warmupPromise: Promise<void> | null = null;

/** Optional connect + SQLite PRAGMA setup on server startup. */
export async function warmupDatabase(): Promise<void> {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      const { ensurePrismaSqliteConfigured, prisma } = await import("@/lib/prisma");
      await ensurePrismaSqliteConfigured();
      await prisma.$connect();
    })().catch((e) => {
      warmupPromise = null;
      console.warn("[dbWarmup] connect failed", e);
    }) as Promise<void>;
  }
  return warmupPromise;
}
