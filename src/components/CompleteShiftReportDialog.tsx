"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ClipboardCheck } from "lucide-react";
import { submitShiftReport } from "@/app/actions";

function formatShiftReportSubmitError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Unknown argument") && msg.includes("status")) {
    return "На сервере не обновлены Prisma и база: выполните «npx prisma db push» и «npx prisma generate», затем перезапустите приложение.";
  }
  if (msg.startsWith("Invalid `prisma.") && msg.length > 200) {
    return "Не удалось сохранить отчёт (ошибка базы). Обновите приложение или обратитесь к администратору.";
  }
  return msg;
}

export function CompleteShiftReportDialog({
  shiftId,
  headline
}: {
  shiftId: string;
  headline: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setError("");
  };

  const overlay =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-background/80 p-4 backdrop-blur-[2px]"
            role="presentation"
            style={{ overscrollBehavior: "contain" }}
            onClick={() => !pending && close()}
          >
            <div
              className="max-h-[min(90dvh,640px)] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-background"
              role="dialog"
              aria-modal
              aria-labelledby="shift-report-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-border/80 px-4 py-4">
                <p id="shift-report-title" className="text-base font-medium tracking-tight">
                  Отчёт по смене
                </p>
                <p className="mt-1 text-sm text-muted">{headline}</p>
              </div>
              <form
                className="space-y-4 px-4 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError("");
                  if (text.trim().length < 5) {
                    setError("Напишите чуть подробнее — минимум 5 символов.");
                    return;
                  }
                  start(async () => {
                    try {
                      await submitShiftReport({ shiftId, text });
                      setText("");
                      close();
                      router.refresh();
                    } catch (err) {
                      setError(formatShiftReportSubmitError(err));
                    }
                  });
                }}
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground" htmlFor={`shift-report-text-${shiftId}`}>
                    Что вы сделали за смену
                  </label>
                  <textarea
                    id={`shift-report-text-${shiftId}`}
                    className="min-h-32 w-full resize-y rounded-lg border-0 bg-transparent px-0 py-2.5 text-sm leading-relaxed outline-none ring-0 focus-visible:outline-none"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setError("");
                    }}
                    placeholder="Опишите выполненную работу"
                    disabled={pending}
                    autoFocus
                  />
                </div>

                {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}

                <div className="grid w-full grid-cols-2 gap-3 pt-1 [grid-template-columns:repeat(2,minmax(0,1fr))]">
                  <button type="button" className="btn-secondary w-full" disabled={pending} onClick={close}>
                    Отменить
                  </button>
                  <button type="submit" className="btn-primary w-full" disabled={pending}>
                    {pending ? "Отправляем…" : "Завершить"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="absolute bottom-3 right-3 z-10 flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-foreground/[0.06]"
        aria-label="Отметить смену выполненной"
        onClick={() => setOpen(true)}
      >
        <ClipboardCheck size={18} className="shrink-0" aria-hidden />
      </button>

      {overlay}
    </>
  );
}
