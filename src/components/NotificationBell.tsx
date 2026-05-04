"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition
} from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { formatDateRu } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  swapRequestId: string | null;
  payload: string | null;
};

/** Выше контента страницы и нижней навигации (50), ниже модалок графика (120) */
const PANEL_Z = 115;

type PanelCoords = { top: number; left: number; maxH: number; width: number };

function measurePanel(triggerEl: HTMLElement): PanelCoords {
  const r = triggerEl.getBoundingClientRect();
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const panelW = Math.min(vw - 24, 22 * 16);
  let left = r.left;
  if (left + panelW > vw - 12) left = Math.max(12, vw - 12 - panelW);
  const top = r.bottom + 6;
  const maxH = Math.min(vh * 0.7, 420, Math.max(160, vh - top - 16));
  return { top, left, maxH, width: panelW };
}

function fallbackPanelCoords(): PanelCoords {
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const width = Math.min(vw - 24, 22 * 16);
  const top = 72;
  const left = 12;
  return { top, left, maxH: Math.min(vh * 0.7, 400, vh - top - 16), width };
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [, start] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recentlyReadUntil, setRecentlyReadUntil] = useState<Record<string, number>>({});
  const autoMarkedForOpenRef = useRef(false);

  const unread = items.filter((i) => !i.readAt).length;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setCoords(measurePanel(el));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();

    const onScrollOrResize = () => updateCoords();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updateCoords]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.status === 401) {
        setItems([]);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { items: NotificationRow[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 90_000);
    return () => window.clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    setActionError(null);
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    /*
     Bubble «click»: срабатывает после клика по элементу — не режем первый же mousedown/target.
     Defer до следующего тика — чтобы клик, открывший панель, не считался «снаружи».
    */
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const id = window.setTimeout(() => {
      document.addEventListener("click", onDocClick);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", onDocClick);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
  };

  const markAllRead = () => {
    start(async () => {
      try {
        setActionError(null);
        const justReadIds = items.filter((n) => !n.readAt).map((n) => n.id);
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ markAll: true })
        });
        if (!res.ok) throw new Error("Не удалось отметить все уведомления");
        const now = new Date().toISOString();
        setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
        if (justReadIds.length) {
          const expireAt = Date.now() + 3000;
          setRecentlyReadUntil((prev) => {
            const next = { ...prev };
            for (const id of justReadIds) next[id] = expireAt;
            return next;
          });
        }
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Не удалось отметить все уведомления");
      }
    });
  };

  useEffect(() => {
    if (!open) {
      autoMarkedForOpenRef.current = false;
      return;
    }
    if (autoMarkedForOpenRef.current || unread === 0) return;
    autoMarkedForOpenRef.current = true;
    markAllRead();
  }, [open, unread]);

  useEffect(() => {
    const iv = window.setInterval(() => {
      const now = Date.now();
      setRecentlyReadUntil((prev) => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [id, until] of Object.entries(prev)) {
          if (until > now) {
            next[id] = until;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 350);
    return () => window.clearInterval(iv);
  }, []);

  const panelPos = open && mounted ? (coords ?? fallbackPanelCoords()) : null;

  const panel =
    open && mounted && panelPos ? (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxH,
          zIndex: PANEL_Z
        }}
        className="flex flex-col overflow-hidden rounded-lg border border-border bg-background animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="shrink-0 border-b border-border/80 px-3 py-2">
          <p className="text-sm font-semibold tracking-tight">Уведомления</p>
          <p className="text-[10px] text-muted">Важные сообщения из приложения</p>
        </div>
        <div className="min-h-[120px] min-w-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {loading && items.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">Пока пусто</p>
          ) : (
            <ul className="space-y-2">
              {items.map((n) => {
                const iso = typeof n.createdAt === "string" ? n.createdAt : String(n.createdAt);
                const d = new Date(iso);
                const created = Number.isFinite(d.getTime()) ? formatDateRu(d, "dd.MM.yy HH:mm") : "";
                const showDot = n.readAt === null || (recentlyReadUntil[n.id] ?? 0) > Date.now();
                /* Сломать data detection в WebView: невидимый ZWSP после «, » */
                const bodyPlain = n.body.replace(/, /g, ",\u200B ");
                return (
                  <li
                    key={n.id}
                    className="notification-item-plain rounded-xl border border-border bg-transparent px-2.5 py-2"
                  >
                    <p className="text-[10px] text-muted">{created}</p>
                    <div className="notification-plain-text mt-1 flex items-start justify-between gap-2">
                      <p className="notification-plain-text text-[13px] font-semibold leading-snug">{n.title}</p>
                      {showDot ? (
                        <span
                          aria-hidden
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-muted/60" : "bg-foreground/90"}`}
                        />
                      ) : null}
                    </div>
                    <p className="notification-plain-text mt-1 whitespace-pre-wrap text-[12px] leading-snug text-muted">
                      {bodyPlain}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {actionError ? (
          <p className="shrink-0 border-t border-border bg-muted/[0.04] px-3 py-2 text-[11px] font-medium text-foreground/85">
            {actionError}
          </p>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <div className="flex justify-start">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => void toggle()}
          className="relative inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border border-border bg-transparent text-foreground transition hover:bg-foreground/[0.06]"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Уведомления${unread ? `, непрочитанных: ${unread}` : ""}`}
        >
          <Bell size={16} className={unread ? "text-foreground" : "text-muted"} />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-medium text-background">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </div>
      {mounted && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </>
  );
}
