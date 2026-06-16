"use client";

import { useEffect, useState } from "react";
import { getCachedAvatarBlobUrl, shouldUseClientAvatarCache } from "@/lib/avatarClientCache";

type UserAvatarProps = {
  name: string;
  photoUrl?: string | null;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const sizeClassMap = {
  sm: "h-4 w-4 text-[9px]",
  md: "h-11 w-11 text-sm",
  lg: "h-12 w-12 text-sm"
} as const;

export function UserAvatar({ name, photoUrl, color, size = "md", className = "" }: UserAvatarProps) {
  const trimmedUrl = photoUrl?.trim() ?? "";
  const useClientCache = shouldUseClientAvatarCache(trimmedUrl);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() =>
    trimmedUrl && !shouldUseClientAvatarCache(trimmedUrl) ? trimmedUrl : null
  );
  const sizeClass = sizeClassMap[size];
  const baseClass = `inline-flex items-center justify-center rounded-full border border-border object-cover ${sizeClass} ${className}`.trim();
  const showPhoto = Boolean(trimmedUrl) && !photoFailed;

  useEffect(() => {
    setPhotoFailed(false);
  }, [trimmedUrl]);

  useEffect(() => {
    if (!showPhoto) {
      setResolvedSrc(null);
      return;
    }

    if (!useClientCache) {
      setResolvedSrc(trimmedUrl);
      return;
    }

    let cancelled = false;
    void getCachedAvatarBlobUrl(trimmedUrl)
      .then((url) => {
        if (!cancelled) setResolvedSrc(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [showPhoto, trimmedUrl, useClientCache]);

  if (showPhoto && resolvedSrc) {
    return (
      // Telegram CDN — сырой img + SW-кэш; локальные — blob из Cache API.
      // eslint-disable-next-line @next/next/no-img-element -- external avatar URLs
      <img
        src={resolvedSrc}
        alt={name}
        className={baseClass}
        loading="lazy"
        decoding="async"
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${baseClass} font-semibold text-white`}
      style={{ backgroundColor: color || "#6b7280" }}
      aria-label={name}
    >
      {initialsFromName(name)}
    </span>
  );
}
