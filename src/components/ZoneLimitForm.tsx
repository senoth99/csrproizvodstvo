"use client";
import { useState, useTransition } from "react";
import { createZoneLimit } from "@/app/actions";

export function ZoneLimitForm({ zones }: { zones: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <form
      className="card grid gap-2 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            await createZoneLimit({
              zoneId: String(fd.get("zoneId")),
              dayOfWeek: fd.get("dayOfWeek") ? Number(fd.get("dayOfWeek")) : null,
              startTime: String(fd.get("startTime")),
              endTime: String(fd.get("endTime")),
              maxEmployees: Number(fd.get("maxEmployees"))
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось сохранить лимит");
          }
        });
      }}
    >
      <select name="zoneId" className="rounded-lg bg-surface p-2">{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      <input name="dayOfWeek" type="number" min={1} max={7} placeholder="1-7 или пусто" className="rounded-lg bg-surface p-2" />
      <input name="startTime" type="time" defaultValue="10:00" className="rounded-lg bg-surface p-2" />
      <input name="endTime" type="time" defaultValue="18:00" className="rounded-lg bg-surface p-2" />
      <input name="maxEmployees" type="number" defaultValue={2} className="rounded-lg bg-surface p-2" />
      <button className="btn-primary" disabled={pending}>
        {pending ? "..." : "Сохранить лимит"}
      </button>
      {error ? <p className="text-sm font-medium text-foreground/85 md:col-span-6">{error}</p> : null}
    </form>
  );
}
