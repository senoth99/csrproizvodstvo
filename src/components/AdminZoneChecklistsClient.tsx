"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createZoneChecklistItem,
  deleteZoneChecklistItem,
  updateZoneChecklistItem
} from "@/app/actions";

export type AdminZoneChecklist = {
  id: string;
  name: string;
  items: { id: string; label: string; sortOrder: number; isActive: boolean }[];
};

export function AdminZoneChecklistsClient({ zones }: { zones: AdminZoneChecklist[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<void>) => {
    setError("");
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    });
  };

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm font-medium text-foreground/90">{error}</p> : null}
      {zones.map((zone) => (
        <section key={zone.id} className="card space-y-3">
          <h2 className="text-base font-semibold">{zone.name}</h2>
          <p className="text-xs text-muted">
            Пункты чеклиста показываются сотруднику при сдаче отчёта по смене в этой зоне.
          </p>
          <ul className="space-y-2">
            {zone.items.length === 0 ? (
              <li className="text-sm text-muted">Пока нет пунктов.</li>
            ) : (
              zone.items.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${
                    item.isActive ? "border-border" : "border-border/60 opacity-60"
                  }`}
                >
                  <input
                    type="text"
                    className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                    defaultValue={item.label}
                    disabled={pending}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (!next || next === item.label) return;
                      run(() => updateZoneChecklistItem({ id: item.id, label: next }));
                    }}
                  />
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      disabled={pending}
                      onChange={(e) =>
                        run(() => updateZoneChecklistItem({ id: item.id, isActive: e.target.checked }))
                      }
                    />
                    Активен
                  </label>
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Удалить пункт чеклиста?")) return;
                      run(() => deleteZoneChecklistItem(item.id));
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                    Удалить
                  </button>
                </li>
              ))
            )}
          </ul>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const label = (drafts[zone.id] ?? "").trim();
              if (!label) return;
              run(async () => {
                await createZoneChecklistItem({ zoneId: zone.id, label });
                setDrafts((prev) => ({ ...prev, [zone.id]: "" }));
              });
            }}
          >
            <input
              type="text"
              className="min-w-[12rem] flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              placeholder="Новый пункт чеклиста"
              value={drafts[zone.id] ?? ""}
              disabled={pending}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [zone.id]: e.target.value }))}
            />
            <button type="submit" className="btn-primary inline-flex items-center gap-1.5" disabled={pending}>
              <Plus size={16} aria-hidden />
              Добавить
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
