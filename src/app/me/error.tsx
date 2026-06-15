"use client";

export default function MePageError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card space-y-3 py-10 text-center">
      <p className="text-sm font-medium text-foreground">Не удалось загрузить кабинет</p>
      <p className="text-xs text-muted">{error.message || "Попробуйте обновить страницу."}</p>
      <button type="button" className="btn-primary mx-auto" onClick={() => reset()}>
        Повторить
      </button>
    </div>
  );
}
