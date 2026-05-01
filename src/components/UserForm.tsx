"use client";
import { useTransition } from "react";
import { createUser } from "@/app/actions";

export function UserForm() {
  const [pending, start] = useTransition();
  return (
    <form className="card grid gap-2 md:grid-cols-5" action={(fd) => start(async () => createUser({
      name: String(fd.get("name")),
      role: String(fd.get("role")),
      color: String(fd.get("color")),
      isActive: fd.get("isActive") === "on"
    }))}>
      <input name="name" placeholder="Имя" className="rounded-lg bg-surface p-2" />
      <select name="role" className="rounded-lg bg-surface p-2"><option>EMPLOYEE</option><option>SUPER_ADMIN</option></select>
      <input name="color" defaultValue="#1f8f5f" className="rounded-lg bg-surface p-2" />
      <label className="flex items-center gap-2"><input name="isActive" type="checkbox" defaultChecked />Активен</label>
      <button className="btn-primary" disabled={pending}>{pending ? "..." : "Создать пользователя"}</button>
    </form>
  );
}
