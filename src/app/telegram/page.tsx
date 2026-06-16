import { redirect } from "next/navigation";

/** Совместимость с короткой ссылкой /telegram — ведём на основной вход. */
export default function TelegramEntryRedirectPage() {
  redirect("/login");
}
