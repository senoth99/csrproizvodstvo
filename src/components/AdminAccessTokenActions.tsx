"use client";

import { useState, useTransition } from "react";
import { generateAccessToken } from "@/app/actions";

export function AdminAccessTokenActions({ userId, userName }: { userId: string; userName: string }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-2">
      <button
        type="button"
        className="btn-secondary self-start"
        disabled={pending}
        onClick={() => {
          setError("");
          start(async () => {
            try {
              const generated = await generateAccessToken(userId);
              setLink(generated);
            } catch (err) {
              setLink("");
              setError(err instanceof Error ? err.message : "Не удалось сгенерировать ссылку");
            }
          });
        }}
      >
        {pending ? "Генерируем…" : "Сгенерировать ссылку входа"}
      </button>
      {link ? (
        <div className="space-y-1 rounded-lg border border-border bg-surface px-3 py-2">
          <p className="text-xs font-medium text-muted">Ссылка входа для {userName}</p>
          <a href={link} className="break-all text-sm text-accent underline-offset-2 hover:underline">
            {link}
          </a>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(link);
            }}
          >
            Копировать
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}
    </div>
  );
}
