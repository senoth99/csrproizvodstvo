import type { ReactNode } from "react";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  children: ReactNode;
  /** Под заголовком, приглушённый текст */
  description?: ReactNode;
  /** Классы для заголовка (welcome: крупнее) */
  titleClassName?: string;
};

/** Полноэкранный экран авторизации/onboarding — чёрный фон, минимальный ореол акцента */
export function AuthScreenShell({
  title,
  description,
  children,
  titleClassName = "ui-page-title text-2xl font-bold sm:text-3xl"
}: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-5 pb-[max(1.25rem,var(--safe-bottom))] pt-[max(1.25rem,var(--safe-top))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(0,51,34,0.35),transparent_42%)]" />
      <div className="relative w-full max-w-md space-y-6 rounded-lg border border-border bg-background p-6 animate-in md:p-8">
        <div className="space-y-3 text-center">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" />
            <img src={BRAND_LOGO_SRC} alt="Logo" className="relative h-24 w-24 object-contain animate-logo-spin" />
          </div>
          <h1 className={cn(titleClassName)}>{title}</h1>
          {description ? (
            <div className="text-sm leading-relaxed text-muted">{description}</div>
          ) : null}
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}
