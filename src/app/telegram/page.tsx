import { redirect } from "next/navigation";

/** Совместимость с короткой ссылкой /telegram без /login — иначе 404 и лишний стресс при отладке. */
export default function TelegramEntryRedirectPage() {
  redirect("/telegram/login");
}
