"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { compressImageFile } from "@/lib/clientImageCompress";

const errorMessages: Record<string, string> = {
  file_required: "Выберите изображение",
  file_too_large: "Файл слишком большой (макс. 512 КБ)",
  invalid_file_type: "Поддерживаются JPG, PNG, WebP, GIF",
  upload_failed: "Не удалось загрузить аватар",
  delete_failed: "Не удалось удалить аватар"
};

export function AvatarUploadControl({
  name,
  photoUrl,
  accentColor,
  hasCustomAvatar,
  onChanged
}: {
  name: string;
  photoUrl: string | null;
  accentColor: string;
  hasCustomAvatar: boolean;
  onChanged?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const displayUrl = previewUrl ?? photoUrl;

  function handlePick() {
    setError("");
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    start(async () => {
      setError("");
      try {
        const blob = await compressImageFile(file, 512, 0.85);
        const blobUrl = URL.createObjectURL(blob);
        setPreviewUrl(blobUrl);

        const form = new FormData();
        form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
        const res = await fetch("/api/users/avatar", { method: "POST", body: form });
        const body = (await res.json().catch(() => ({}))) as { error?: string; path?: string };
        URL.revokeObjectURL(blobUrl);
        if (!res.ok) {
          setPreviewUrl(null);
          setError(errorMessages[body.error ?? ""] ?? "Не удалось загрузить аватар");
          return;
        }
        if (body.path) setPreviewUrl(body.path);
        onChanged?.();
      } catch {
        setPreviewUrl(null);
        setError("Не удалось обработать изображение");
      }
    });
  }

  function handleRemove() {
    start(async () => {
      setError("");
      const res = await fetch("/api/users/avatar", { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(errorMessages[body.error ?? ""] ?? "Не удалось удалить аватар");
        return;
      }
      setPreviewUrl(null);
      onChanged?.();
    });
  }

  return (
    <div className="relative shrink-0">
      <UserAvatar name={name} photoUrl={displayUrl} color={accentColor} size="lg" />
      <div className="absolute -bottom-1 -right-1 flex gap-0.5">
        <button
          type="button"
          className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-full border border-border bg-background text-muted shadow-sm transition hover:bg-foreground/[0.07] hover:text-foreground disabled:opacity-50"
          aria-label="Загрузить аватар"
          disabled={pending}
          onClick={handlePick}
        >
          <Camera size={14} aria-hidden />
        </button>
        {hasCustomAvatar || previewUrl?.includes("/api/users/avatar") ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-full border border-border bg-background text-muted shadow-sm transition hover:bg-foreground/[0.07] hover:text-foreground disabled:opacity-50"
            aria-label="Удалить аватар"
            disabled={pending}
            onClick={handleRemove}
          >
            <Trash2 size={14} aria-hidden />
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
      />
      {error ? <p className="absolute left-0 top-full mt-1 w-40 text-[10px] leading-tight text-foreground/80">{error}</p> : null}
    </div>
  );
}
