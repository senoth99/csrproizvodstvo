import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const CACHE_TAGS = {
  zones: "zones",
  employees: "employees",
  systemSettings: "system-settings"
} as const;

export const getCachedZones = unstable_cache(
  async () =>
    prisma.zone.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true, color: true }
    }),
  ["zones-list"],
  { revalidate: 60, tags: [CACHE_TAGS.zones] }
);

export const getCachedSystemSettings = unstable_cache(
  async () =>
    prisma.systemSettings.findMany({
      select: { key: true, value: true }
    }),
  ["system-settings-all"],
  { revalidate: 60, tags: [CACHE_TAGS.systemSettings] }
);

export function getCachedSystemSetting(key: string) {
  return unstable_cache(
    async () =>
      prisma.systemSettings.findUnique({
        where: { key },
        select: { key: true, value: true }
      }),
    ["system-setting", key],
    { revalidate: 60, tags: [CACHE_TAGS.systemSettings, `${CACHE_TAGS.systemSettings}:${key}`] }
  )();
}

export const getCachedActiveEmployeesForSchedule = unstable_cache(
  async () =>
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        telegramPhotoUrl: true,
        avatarUpdatedAt: true
      }
    }),
  ["schedule-active-employees"],
  { revalidate: 60, tags: [CACHE_TAGS.employees] }
);
