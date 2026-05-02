import type { ReactNode } from "react";

/** Не отдаём устаревший HTML из кэша: после деплоя Mini App сразу получает новый клиентский бандл. */
export const dynamic = "force-dynamic";

export default function TelegramLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
