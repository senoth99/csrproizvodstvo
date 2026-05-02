"use client";

import { useState, useTransition } from "react";
import { createShift } from "@/app/actions";

export function ShiftFormModal({ userId, zones, weekStartDate }: { userId: string; zones: { id: string; name: string }[]; weekStartDate: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="card grid gap-2 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          setError("");
          try {
            await createShift({
              userId,
              zoneId: String(fd.get("zoneId")),
              weekStartDate,
              dayOfWeek: Number(fd.get("dayOfWeek")),
              startTime: String(fd.get("startTime")),
              endTime: String(fd.get("endTime"))
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка создания смены");
          }
        });
      }}
    >
      <select name="dayOfWeek" className="rounded-lg bg-surface p-2">{[1,2,3,4,5,6,7].map((d) => <option key={d} value={d}>{d}</option>)}</select>
      <select name="zoneId" className="rounded-lg bg-surface p-2">{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      <input name="startTime" type="time" defaultValue="10:00" className="rounded-lg bg-surface p-2" />
      <input name="endTime" type="time" defaultValue="18:00" className="rounded-lg bg-surface p-2" />
      <button disabled={pending} className="btn-primary md:col-span-2">{pending ? "Сохраняем..." : "Поставить смену"}</button>
      {error && <p className="md:col-span-6 text-sm font-medium text-foreground/85">{error}</p>}
    </form>
  );
}
