/** SQLite иногда отвечает SQLITE_BUSY при параллельных записях (уведомления + refresh). */
export function isSqliteBusyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return msg.includes("SQLITE_BUSY") || msg.includes("database is locked");
}

export async function withSqliteRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isSqliteBusyError(e) || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 40 * (i + 1)));
    }
  }
  throw last;
}
