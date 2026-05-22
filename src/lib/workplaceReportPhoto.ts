import { existsSync } from "fs";
import { mkdirSync } from "fs";
import path from "path";

/** Папка вне git и пересборки Next — на VPS обычно рядом с SQLite (`/data/app/uploads`). */
export function getUploadsRoot(): string {
  const fromEnv = process.env.UPLOADS_DIR?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv);
  }
  const dbUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (dbUrl.startsWith("file:")) {
    const dbPath = dbUrl.slice("file:".length);
    const absDb = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
    return path.join(path.dirname(absDb), "uploads");
  }
  return path.join(process.cwd(), "data", "uploads");
}

function reportPhotoDiskPath(shiftId: string): string {
  return path.join(getUploadsRoot(), "reports", `${shiftId}.jpg`);
}

export function getReportPhotoDiskPath(shiftId: string): string {
  const p = reportPhotoDiskPath(shiftId);
  mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

/** URL для `<img>` и БД — отдаётся через API с проверкой сессии. */
export function getReportPhotoApiPath(shiftId: string): string {
  return `/api/reports/workplace-photo?shiftId=${encodeURIComponent(shiftId)}`;
}

/** Где лежит файл: новая папка данных, затем legacy `public/uploads`. */
export function resolveReportPhotoDiskPath(shiftId: string): string | null {
  const primary = reportPhotoDiskPath(shiftId);
  if (existsSync(primary)) return primary;
  const legacy = path.join(process.cwd(), "public", "uploads", "reports", `${shiftId}.jpg`);
  if (existsSync(legacy)) return legacy;
  return null;
}

export function normalizeReportPhotoPath(
  storedPath: string | null | undefined,
  shiftId: string
): string | null {
  if (!storedPath?.trim()) return null;
  return getReportPhotoApiPath(shiftId);
}
