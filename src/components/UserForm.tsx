"use client";
import { useState, useTransition } from "react";
import { createUser } from "@/app/actions";
import { UserRole } from "@/lib/enums";

export function UserForm() {
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
            await createUser({
              name: String(fd.get("name")),
              role: String(fd.get("role")),
              color: String(fd.get("color")),
              isActive: fd.get("isActive") === "on"
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось создать пользователя");
          }
        });
      }}
    >
      <input name="name" placeholder="Имя" className="rounded-lg bg-surface p-2" />
      <select name="role" className="rounded-lg bg-surface p-2">
        <option value={UserRole.EMPLOYEE}>EMPLOYEE</option>
        <option value={UserRole.ADMIN}>ADMIN</option>
        <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
      </select>
      <input name="color" defaultValue="#1f8f5f" className="rounded-lg bg-surface p-2" />
      <label className="flex items-center gap-2">
        <input name="isActive" type="checkbox" defaultChecked />
        Активен
      </label>
      <button className="btn-primary" disabled={pending}>
        {pending ? "..." : "Создать пользователя"}
      </button>
      {error ? <p className="text-sm font-medium text-foreground/85 md:col-span-5">{error}</p> : null}
    </form>
  );
}
