"use client";

export function ConfirmDialog({ text, onConfirm }: { text: string; onConfirm: () => void }) {
  return (
    <button className="btn-secondary" onClick={() => window.confirm(text) && onConfirm()}>
      Подтвердить
    </button>
  );
}
