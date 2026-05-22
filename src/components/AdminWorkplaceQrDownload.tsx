"use client";

export function AdminWorkplaceQrDownload() {
  return (
    <a
      href="/api/admin/workplace-qr"
      download="workplace-qr.png"
      className="btn-secondary inline-flex min-h-[44px] items-center justify-center touch-manipulation"
    >
      Скачать QR-код
    </a>
  );
}
