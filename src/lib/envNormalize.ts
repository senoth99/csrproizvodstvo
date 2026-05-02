/** В `.env` часто задают значения в кавычках; некоторые рантаймы оставляют `"`/`'` в строке → ломают URL/JWT/crypto. */
export function stripOptionalEnvQuotes(value: string | undefined): string {
  let s = (value ?? "").trim();
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Нормализация строки URL БД из env (без подключения к Prisma). */
export function normalizeDatabaseUrlEnv(value: string | undefined): string {
  return stripOptionalEnvQuotes(value);
}
