import Link from "next/link";
import { X } from "lucide-react";
import { getContactTelegramUsername } from "@/lib/contactTelegram";

export default function AccessDeniedPage() {
  const handle = getContactTelegramUsername();
  const tgUrl = `https://t.me/${encodeURIComponent(handle)}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background px-6 py-10 pb-[max(2.5rem,var(--safe-bottom))] pt-[max(2.5rem,var(--safe-top))]">
      <div className="relative w-full max-w-md space-y-6 rounded-lg border border-border bg-background px-6 py-8 text-center animate-in">
        <div className="mx-auto flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full border border-border bg-muted/[0.08]">
          <X className="h-10 w-10 text-muted" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="ui-page-title text-[1.35rem] sm:text-[1.5rem]">У вас нет доступа</h1>
          <p className="text-sm leading-relaxed text-muted">
            Обратитесь к{" "}
            <Link href={tgUrl} className="link-tech text-sm" target="_blank" rel="noopener noreferrer">
              @{handle}
            </Link>
            {" — "}
            <span className="text-foreground/80">выдадут доступ или подскажут, что нужно для входа.</span>
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-muted/85">
          Ссылка в Telegram:{" "}
          <Link
            href={tgUrl}
            className="link-tech break-all font-mono text-[10px]"
            target="_blank"
            rel="noopener noreferrer"
          >
            {tgUrl}
          </Link>
        </p>
      </div>
    </div>
  );
}
