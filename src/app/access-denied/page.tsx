import Link from "next/link";
import { getContactTelegramUsername } from "@/lib/contactTelegram";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

export default function AccessDeniedPage() {
  const handle = getContactTelegramUsername();
  const tgUrl = `https://t.me/${encodeURIComponent(handle)}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background px-6 py-10 pb-[max(2.5rem,var(--safe-bottom))] pt-[max(2.5rem,var(--safe-top))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(0,51,34,0.35),transparent_42%)]" />
      <div className="relative w-full max-w-md space-y-6 rounded-lg border border-border bg-background px-6 py-8 text-center animate-in">
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" />
          <img src={BRAND_LOGO_SRC} alt="" className="relative h-24 w-24 object-contain animate-logo-spin" />
        </div>

        <div className="space-y-2">
          <h1 className="ui-page-title text-[1.35rem] sm:text-[1.5rem]">Доступ запрещён</h1>
          <p className="text-sm leading-relaxed text-muted">
            Обратитесь к{" "}
            <Link href={tgUrl} className="link-tech text-sm" target="_blank" rel="noopener noreferrer">
              @{handle}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
