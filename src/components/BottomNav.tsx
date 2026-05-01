"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, UserCircle2 } from "lucide-react";

const items = [
  { href: "/schedule", label: "График", icon: CalendarDays },
  { href: "/me", label: "Кабинет", icon: UserCircle2 },
  { href: "/reports", label: "Отчеты", icon: BarChart3, disabled: true }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto grid max-w-5xl grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          if (item.disabled) {
            return (
              <button
                key={item.href}
                type="button"
                disabled
                className="flex cursor-not-allowed flex-col items-center justify-center gap-1 py-2 text-xs text-muted/60"
                title="Раздел в разработке"
              >
                <span className="relative inline-flex h-5 w-5 items-center justify-center">
                  <Icon size={18} />
                  <span className="absolute top-[0.5rem] left-1/2 w-max -translate-x-[50%] rounded-full border border-border bg-surface px-1 py-[1px] text-[8px] font-semibold uppercase leading-none tracking-[0.01em] text-muted opacity-80">
                    Скоро
                  </span>
                </span>
                <span className="leading-none">Отчеты</span>
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-xs transition ${
                active ? "text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center">
                <Icon size={18} />
              </span>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
