/** Client-side resize/compress before upload (canvas). */
export async function compressImageFile(
  file: File,
  maxSide = 1280,
  quality = 0.82
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      el.src = url;
    });

    let { width, height } = img;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен.");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Не удалось сжать изображение."))),
        "image/jpeg",
        quality
      );
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
