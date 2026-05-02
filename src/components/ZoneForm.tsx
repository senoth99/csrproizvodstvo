"use client";
import { useState, useTransition } from "react";
import { createZone } from "@/app/actions";

export function ZoneForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <form
      className="card grid gap-2 md:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            await createZone({
              name: String(fd.get("name")),
              description: String(fd.get("description") || ""),
              color: String(fd.get("color") || "#1f8f5f"),
              sortOrder: Number(fd.get("sortOrder") || 0)
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось создать зону");
          }
        });
      }}
    >
      <input name="name" placeholder="Название зоны" className="rounded-lg bg-surface p-2" />
      <input name="description" placeholder="Описание" className="rounded-lg bg-surface p-2" />
      <input name="color" defaultValue="#1f8f5f" className="rounded-lg bg-surface p-2" />
      <input name="sortOrder" type="number" defaultValue={0} className="rounded-lg bg-surface p-2" />
      <button className="btn-primary" disabled={pending}>
        {pending ? "..." : "Создать зону"}
      </button>
      {error ? <p className="text-sm font-medium text-foreground/85 md:col-span-5">{error}</p> : null}
    </form>
  );
}
