"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, LayoutDashboard, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({ showManager = false }: { showManager?: boolean }) {
  const pathname = usePathname() ?? "";

  const items = (
    [
      { href: "/schedule", label: "График", icon: CalendarDays },
      { href: "/me", label: "Кабинет", icon: UserCircle2 },
      ...(showManager ? [{ href: "/manager", label: "Панель", icon: LayoutDashboard }] : []),
      { href: "/reports", label: "Отчеты", icon: BarChart3 }
    ] as const
  ).map((item) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex min-h-[52px] touch-manipulation flex-col items-center justify-center gap-1 border-b-2 border-transparent px-1 pb-2 pt-1 transition-colors",
          active ? "border-foreground text-foreground" : "text-muted hover:text-foreground/90"
        )}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center">
          <Icon size={20} aria-hidden />
        </span>
        <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.12em]">{item.label}</span>
      </Link>
    );
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-black backdrop-blur-[2px]">
      <div className={cn("mx-auto grid max-w-5xl", items.length >= 4 ? "grid-cols-4" : "grid-cols-3")}>{items}</div>
    </nav>
  );
}
