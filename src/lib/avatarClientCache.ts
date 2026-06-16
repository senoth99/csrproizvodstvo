const MEMORY = new Map<string, string>();
const CACHE_NAME = "avatar-images-v1";

function isLocalAvatarUrl(url: string): boolean {
  return url.startsWith("/api/users/avatar");
}

/** Локальные аватары (/api/users/avatar) — blob URL из Cache API + память. */
export async function getCachedAvatarBlobUrl(photoUrl: string): Promise<string> {
  const cached = MEMORY.get(photoUrl);
  if (cached) return cached;

  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(photoUrl);
      if (hit) {
        const blob = await hit.blob();
        const blobUrl = URL.createObjectURL(blob);
        MEMORY.set(photoUrl, blobUrl);
        return blobUrl;
      }
    } catch {
      /* offline / private mode */
    }
  }

  const res = await fetch(photoUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error("avatar_fetch_failed");

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  MEMORY.set(photoUrl, blobUrl);

  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        photoUrl,
        new Response(blob, {
          headers: { "Content-Type": blob.type || "image/jpeg" }
        })
      );
    } catch {
      /* quota / private mode */
    }
  }

  return blobUrl;
}

export function shouldUseClientAvatarCache(photoUrl: string | null | undefined): photoUrl is string {
  if (typeof photoUrl !== "string") return false;
  const trimmed = photoUrl.trim();
  return trimmed.length > 0 && isLocalAvatarUrl(trimmed);
}
