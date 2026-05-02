import { stripOptionalEnvQuotes } from "@/lib/envNormalize";

/** Общий секрет JWT сессии (layout, middleware, магические ссылки) — один источник, без кавычек из .env. */
export function sessionSecretBytes(): Uint8Array {
  const raw = stripOptionalEnvQuotes(process.env.SESSION_SECRET);
  const value = raw || "dev_session_secret_change_me";
  return new TextEncoder().encode(value);
}
