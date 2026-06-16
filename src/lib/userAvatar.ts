import { existsSync } from "fs";
import { mkdirSync } from "fs";
import path from "path";
import { getUploadsRoot } from "@/lib/workplaceReportPhoto";

function avatarDiskPath(userId: string): string {
  return path.join(getUploadsRoot(), "avatars", `${userId}.jpg`);
}

export function getAvatarDiskPath(userId: string): string {
  const p = avatarDiskPath(userId);
  mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

export function resolveAvatarDiskPath(userId: string): string | null {
  const p = avatarDiskPath(userId);
  return existsSync(p) ? p : null;
}

export function getAvatarApiPath(userId: string, version?: number | Date | null): string {
  const v =
    version instanceof Date
      ? version.getTime()
      : typeof version === "number"
        ? version
        : Date.now();
  return `/api/users/avatar?userId=${encodeURIComponent(userId)}&v=${v}`;
}

/** Загруженный аватар приоритетнее telegramPhotoUrl. */
export function resolveUserAvatarUrl(user: {
  id: string;
  avatarUpdatedAt?: Date | string | null;
  telegramPhotoUrl?: string | null;
}): string | null {
  if (user.avatarUpdatedAt) {
    const t =
      user.avatarUpdatedAt instanceof Date
        ? user.avatarUpdatedAt.getTime()
        : new Date(user.avatarUpdatedAt).getTime();
    if (!Number.isNaN(t)) return getAvatarApiPath(user.id, t);
  }
  const tg = user.telegramPhotoUrl?.trim();
  return tg || null;
}
