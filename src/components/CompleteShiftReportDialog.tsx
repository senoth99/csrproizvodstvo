"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Camera, ClipboardCheck, ClipboardList, Heart, ImagePlus } from "lucide-react";
import { getShiftChecklistForReport, getShiftCoworkersForLike, submitShiftReport } from "@/app/actions";
import { UserAvatar } from "@/components/UserAvatar";
import { compressImageFile } from "@/lib/clientImageCompress";
import { computeWorkedMinutes, formatWorkedMinutes } from "@/lib/workedHours";
import { cn } from "@/lib/utils";

type ChecklistItem = { id: string; label: string };

type CoworkerOption = {
  id: string;
  name: string;
  color: string;
  telegramPhotoUrl: string | null;
};

function formatShiftReportSubmitError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("no such table") && (msg.includes("ShiftPeerLike") || msg.includes("ShiftReportChecklistAnswer"))) {
    return "На сервере не применены миграции БД. Администратору: git pull && ./deploy.sh (или npx prisma migrate deploy).";
  }
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
  headline,
  defaultStartTime = "",
  defaultEndTime = ""
}: {
  shiftId: string;
  headline: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [workStartTime, setWorkStartTime] = useState(defaultStartTime);
  const [workEndTime, setWorkEndTime] = useState(defaultEndTime);
  const [workplacePhotoPath, setWorkplacePhotoPath] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState("");
  const [likedUserId, setLikedUserId] = useState<string | null>(null);
  const [coworkers, setCoworkers] = useState<CoworkerOption[]>([]);
  const [coworkersLoading, setCoworkersLoading] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCoworkersLoading(true);
    setChecklistLoading(true);
    setCoworkers([]);
    setChecklistItems([]);
    setChecklistChecked({});
    setLikedUserId(null);
    void (async () => {
      try {
        const [list, checklist] = await Promise.all([
          getShiftCoworkersForLike(shiftId),
          getShiftChecklistForReport(shiftId)
        ]);
        if (!cancelled) {
          setCoworkers(list);
          setChecklistItems(checklist);
          setChecklistChecked(Object.fromEntries(checklist.map((item) => [item.id, false])));
        }
      } catch {
        if (!cancelled) {
          setCoworkers([]);
          setChecklistItems([]);
        }
      } finally {
        if (!cancelled) {
          setCoworkersLoading(false);
          setChecklistLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, shiftId]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const resetPhoto = () => {
    if (photoPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl("");
    setWorkplacePhotoPath("");
  };

  const close = () => {
    setOpen(false);
    setError("");
    setText("");
    setWorkStartTime(defaultStartTime);
    setWorkEndTime(defaultEndTime);
    setLikedUserId(null);
    setChecklistChecked({});
    resetPhoto();
  };

  const workedPreview = (() => {
    if (!workStartTime || !workEndTime) return null;
    try {
      return formatWorkedMinutes(computeWorkedMinutes(workStartTime, workEndTime));
    } catch {
      return null;
    }
  })();

  const handlePhotoSelected = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setPhotoUploading(true);
    if (photoPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(photoPreviewUrl);
    try {
      const blob = await compressImageFile(file);
      const preview = URL.createObjectURL(blob);
      setPhotoPreviewUrl(preview);
      const form = new FormData();
      form.append("shiftId", shiftId);
      form.append("file", new File([blob], "workplace.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/reports/workplace-photo", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok) {
        URL.revokeObjectURL(preview);
        setPhotoPreviewUrl("");
        setWorkplacePhotoPath("");
        const errKey = body.error ?? "upload_failed";
        if (errKey === "file_too_large") {
          setError("Фото слишком большое (макс. 3 МБ).");
        } else if (errKey === "unauthorized") {
          setError("Нужна авторизация. Обновите страницу и войдите снова.");
        } else {
          setError("Не удалось загрузить фото. Попробуйте ещё раз.");
        }
        return;
      }
      if (!body.path) {
        URL.revokeObjectURL(preview);
        setPhotoPreviewUrl("");
        setError("Не удалось загрузить фото.");
        return;
      }
      setWorkplacePhotoPath(body.path);
    } catch (err) {
      setPhotoPreviewUrl("");
      setWorkplacePhotoPath("");
      setError(err instanceof Error ? err.message : "Не удалось обработать фото.");
    } finally {
      setPhotoUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
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
                  if (!workStartTime || !workEndTime) {
                    setError("Укажите время начала и окончания работы.");
                    return;
                  }
                  if (!workplacePhotoPath) {
                    setError("Добавьте фото рабочего места перед отправкой.");
                    return;
                  }
                  start(async () => {
                    try {
                      await submitShiftReport({
                        shiftId,
                        text,
                        workplacePhotoPath,
                        workStartTime,
                        workEndTime,
                        ...(likedUserId ? { likedUserId } : {}),
                        checklistAnswers: checklistItems.map((item) => ({
                          itemId: item.id,
                          checked: Boolean(checklistChecked[item.id])
                        }))
                      });
                      close();
                      router.refresh();
                    } catch (err) {
                      setError(formatShiftReportSubmitError(err));
                    }
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground" htmlFor={`work-start-${shiftId}`}>
                      Начало работы
                    </label>
                    <input
                      id={`work-start-${shiftId}`}
                      type="time"
                      className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                      value={workStartTime}
                      onChange={(e) => {
                        setWorkStartTime(e.target.value);
                        setError("");
                      }}
                      disabled={pending}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground" htmlFor={`work-end-${shiftId}`}>
                      Конец работы
                    </label>
                    <input
                      id={`work-end-${shiftId}`}
                      type="time"
                      className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                      value={workEndTime}
                      onChange={(e) => {
                        setWorkEndTime(e.target.value);
                        setError("");
                      }}
                      disabled={pending}
                      required
                    />
                  </div>
                  {workedPreview ? (
                    <p className="col-span-2 text-sm text-muted">
                      Отработано: <span className="font-semibold text-foreground">{workedPreview}</span>
                    </p>
                  ) : null}
                </div>

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

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Фото рабочего места</p>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                    disabled={pending || photoUploading}
                    onChange={(e) => void handlePhotoSelected(e.target.files?.[0])}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                    disabled={pending || photoUploading}
                    onChange={(e) => void handlePhotoSelected(e.target.files?.[0])}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary inline-flex items-center gap-2"
                      disabled={pending || photoUploading}
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera size={16} aria-hidden />
                      {photoUploading ? "Загружаем…" : "Сфоткать"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary inline-flex items-center gap-2"
                      disabled={pending || photoUploading}
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      <ImagePlus size={16} aria-hidden />
                      Из галереи
                    </button>
                    {workplacePhotoPath ? (
                      <span className="w-full text-xs text-muted sm:w-auto">Фото загружено</span>
                    ) : null}
                  </div>
                  {photoPreviewUrl ? (
                    // blob: preview — next/image не поддерживает object URL
                    // eslint-disable-next-line @next/next/no-img-element -- local blob preview before upload
                    <img
                      src={photoPreviewUrl}
                      alt="Превью рабочего места"
                      className="max-h-48 w-full rounded-lg border border-border object-cover"
                    />
                  ) : null}
                </div>

                {checklistLoading ? (
                  <p className="text-sm text-muted">Загружаем чеклист…</p>
                ) : checklistItems.length > 0 ? (
                  <div className="space-y-2.5 rounded-lg border border-border/80 bg-foreground/[0.02] px-3 py-3">
                    <div className="flex items-start gap-2">
                      <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">Чеклист смены</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted">
                          Отметьте выполненные пункты. Невыполненные оставьте пустыми.
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {checklistItems.map((item) => (
                        <li key={item.id}>
                          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/70 bg-background/60 px-3 py-2.5 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={Boolean(checklistChecked[item.id])}
                              disabled={pending}
                              onChange={(e) => {
                                setChecklistChecked((prev) => ({ ...prev, [item.id]: e.target.checked }));
                                setError("");
                              }}
                            />
                            <span>{item.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {coworkersLoading ? (
                  <p className="text-sm text-muted">Загружаем коллег на смене…</p>
                ) : coworkers.length > 0 ? (
                  <div className="space-y-2.5 rounded-lg border border-border/80 bg-foreground/[0.02] px-3 py-3">
                    <div className="flex items-start gap-2">
                      <Heart className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">Отметить коллегу</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted">
                          Можно выбрать одного человека. Лайк анонимный — коллега не узнает, кто поставил.
                        </p>
                      </div>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {coworkers.map((coworker) => {
                        const selected = likedUserId === coworker.id;
                        return (
                          <li key={coworker.id}>
                            <button
                              type="button"
                              disabled={pending}
                              aria-pressed={selected}
                              onClick={() => {
                                setLikedUserId((prev) => (prev === coworker.id ? null : coworker.id));
                                setError("");
                              }}
                              className={cn(
                                "inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1.5 pr-3 text-left transition-colors",
                                selected
                                  ? "border-highlight/50 bg-highlight/15"
                                  : "border-foreground/15 bg-foreground/[0.06] hover:bg-foreground/[0.1]"
                              )}
                            >
                              <UserAvatar
                                name={coworker.name}
                                photoUrl={coworker.telegramPhotoUrl}
                                color={coworker.color}
                                size="sm"
                              />
                              <span className="truncate text-xs font-semibold">{coworker.name}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}

                <div className="grid w-full grid-cols-2 gap-3 pt-1 [grid-template-columns:repeat(2,minmax(0,1fr))]">
                  <button type="button" className="btn-secondary w-full" disabled={pending || photoUploading} onClick={close}>
                    Отменить
                  </button>
                  <button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={pending || photoUploading || !workplacePhotoPath}
                  >
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
