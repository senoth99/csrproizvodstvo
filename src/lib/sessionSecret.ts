import { stripOptionalEnvQuotes } from "@/lib/envNormalize";

const DEV_FALLBACK = "dev_session_secret_change_me";
let devFallbackWarned = false;

/** Общий секрет JWT сессии (layout, middleware, магические ссылки) — один источник, без кавычек из .env. */
export function sessionSecretBytes(): Uint8Array {
  const raw = stripOptionalEnvQuotes(process.env.SESSION_SECRET);
  if (raw) {
    return new TextEncoder().encode(raw);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  if (!devFallbackWarned) {
    devFallbackWarned = true;
    console.warn(
      "[sessionSecret] SESSION_SECRET not set — using dev-only fallback. Set SESSION_SECRET in .env before production."
    );
  }
  return new TextEncoder().encode(DEV_FALLBACK);
}
