"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquarePen } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { SwipePageSwitch } from "@/components/SwipePageSwitch";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

/** Шапка/низ через pathname на клиенте — без headers() в root layout (меньше сбоев RSC в dev). */
export function AppShell({
  children,
  showManagerNav,
  showAdminShortcut,
  authenticated
}: {
  children: React.ReactNode;
  showManagerNav: boolean;
  showAdminShortcut: boolean;
  authenticated: boolean;
}) {
  const pathname = usePathname() ?? "";
  const hideAppChrome = pathname === "/telegram/login" || pathname === "/access-denied";

  return (
    <>
      {!hideAppChrome ? (
        <header className="sticky top-0 z-[110] border-b border-border bg-black backdrop-blur-[2px]">
          <div className="mx-auto grid max-w-5xl grid-cols-3 items-center px-3 py-2.5">
            <div className="flex justify-start">{authenticated ? <NotificationBell /> : null}</div>
            <div className="flex justify-center">
              <Link href="/me" aria-label="Открыть личный кабинет">
                <img
                  src={BRAND_LOGO_SRC}
                  alt="Logo"
                  className="h-12 w-auto max-w-[210px] object-contain opacity-95"
                />
              </Link>
            </div>
            <div className="flex justify-end">
              {showAdminShortcut ? (
                <Link
                  href="/admin"
                  className="inline-flex min-h-9 min-w-9 touch-manipulation items-center justify-center rounded-lg border border-border bg-transparent text-foreground transition hover:bg-foreground/[0.07]"
                  aria-label="Админка"
                  title="Админка"
                >
                  <SquarePen size={16} aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}
      <main
        className={cn(
          "mx-auto max-w-5xl",
          hideAppChrome
            ? "min-h-screen min-h-[100dvh] p-0"
            : "min-h-[calc(100vh-108px)] p-3 pb-24 md:min-h-[calc(100vh-120px)] md:p-5 md:pb-24"
        )}
      >
        <SwipePageSwitch>{children}</SwipePageSwitch>
      </main>
      {!hideAppChrome ? <BottomNav showManager={showManagerNav} /> : null}
    </>
  );
}
