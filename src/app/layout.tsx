import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { SquarePen } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { SwipePageSwitch } from "@/components/SwipePageSwitch";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/enums";

export const metadata: Metadata = {
  title: "Производственный график",
  description: "Система графиков и отчетности сотрудников"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const normalizedUsername = (user?.telegramUsername ?? "").toLowerCase();
  const isContactVoropaevAdmin =
    user?.role === UserRole.SUPER_ADMIN &&
    (normalizedUsername === "contact_voropaev" || normalizedUsername === "");

  return (
    <html lang="ru" className="dark">
      <body>
        <header className="border-b border-border bg-surface/90 backdrop-blur">
          <div className="mx-auto grid max-w-5xl grid-cols-3 items-center px-3 py-2">
            <div />
            <div className="flex justify-center">
              <Link href="/me" aria-label="Открыть личный кабинет">
                <img src="/api/brand-logo" alt="Logo" className="h-10 w-auto max-w-[170px] object-contain opacity-95" />
              </Link>
            </div>
            <div className="flex justify-end">
              {isContactVoropaevAdmin ? (
                <Link
                  href="/admin"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-[#1a1f29]"
                  aria-label="Админка"
                  title="Админка"
                >
                  <SquarePen size={17} />
                </Link>
              ) : null}
            </div>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-120px)] max-w-5xl p-3 pb-24 md:min-h-[calc(100vh-132px)] md:p-5 md:pb-24">
          <SwipePageSwitch>{children}</SwipePageSwitch>
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
