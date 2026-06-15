"use client";

import Link from "next/link";
import { Heart, LogIn } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";

export type ManagerPanelLikeItem = {
  userId: string;
  name: string;
  color: string;
  telegramPhotoUrl: string | null;
  count: number;
};

export type ManagerPanelArrivalItem = {
  id: string;
  userId: string;
  name: string;
  color: string;
  telegramPhotoUrl: string | null;
  arrivedAtIso: string;
  arrivedAtLabel: string;
};

export function ManagerPanelInsights({
  likes,
  arrivals
}: {
  likes: ManagerPanelLikeItem[];
  arrivals: ManagerPanelArrivalItem[];
}) {
  if (likes.length === 0 && arrivals.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {likes.length > 0 ? (
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-highlight" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-display">Лайки за сегодня</h2>
          </div>
          <p className="text-[10px] leading-snug text-muted">Лайки анонимны — не видно, кто поставил.</p>
          <ul className="space-y-2">
            {likes.map((item) => (
              <li key={item.userId}>
                <Link
                  href={`/manager/employees/${item.userId}`}
                  className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-foreground/[0.03] px-2.5 py-2 transition-colors hover:bg-foreground/[0.06]"
                >
                  <UserAvatar
                    name={item.name}
                    photoUrl={item.telegramPhotoUrl}
                    color={item.color}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                  <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-highlight/15 px-2 py-0.5 text-xs font-bold tabular-nums text-foreground">
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {arrivals.length > 0 ? (
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-muted" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-display">Приходы сегодня</h2>
          </div>
          <p className="text-[10px] leading-snug text-muted">Отметки по QR-коду на производстве.</p>
          <ul className="space-y-2">
            {arrivals.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/manager/employees/${item.userId}`}
                  className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-foreground/[0.03] px-2.5 py-2 transition-colors hover:bg-foreground/[0.06]"
                >
                  <UserAvatar
                    name={item.name}
                    photoUrl={item.telegramPhotoUrl}
                    color={item.color}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                  <time className="shrink-0 text-xs tabular-nums text-muted" dateTime={item.arrivedAtIso}>
                    {item.arrivedAtLabel}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
