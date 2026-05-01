"use client";
import { useTransition } from "react";
import { createZoneLimit } from "@/app/actions";

export function ZoneLimitForm({ zones }: { zones: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <form className="card grid gap-2 md:grid-cols-6" action={(fd) => start(async () => createZoneLimit({
      zoneId: String(fd.get("zoneId")),
      dayOfWeek: fd.get("dayOfWeek") ? Number(fd.get("dayOfWeek")) : null,
      startTime: String(fd.get("startTime")),
      endTime: String(fd.get("endTime")),
      maxEmployees: Number(fd.get("maxEmployees"))
    }))}>
      <select name="zoneId" className="rounded-lg bg-surface p-2">{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      <input name="dayOfWeek" type="number" min={1} max={7} placeholder="1-7 или пусто" className="rounded-lg bg-surface p-2" />
      <input name="startTime" type="time" defaultValue="10:00" className="rounded-lg bg-surface p-2" />
      <input name="endTime" type="time" defaultValue="18:00" className="rounded-lg bg-surface p-2" />
      <input name="maxEmployees" type="number" defaultValue={2} className="rounded-lg bg-surface p-2" />
      <button className="btn-primary" disabled={pending}>{pending ? "..." : "Сохранить лимит"}</button>
    </form>
  );
}
