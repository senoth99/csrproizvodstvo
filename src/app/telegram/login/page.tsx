import { redirect } from "next/navigation";

type SearchParams = { error?: string };

/** Совместимость: старые ссылки /telegram/login → /login (query error сохраняем). */
export default async function TelegramLoginRedirectPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const error = params.error?.trim();
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/login${query}`);
}
