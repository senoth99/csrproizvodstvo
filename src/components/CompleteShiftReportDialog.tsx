"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Camera, ClipboardCheck, ClipboardList, Heart, ImagePlus } from "lucide-react";
import { getShiftChecklistForReport, getShiftCoworkersForLike, getShiftReportTimes, submitShiftReport } from "@/app/actions";
import { UserAvatar } from "@/components/UserAvatar";
import { compressImageFile } from "@/lib/clientImageCompress";
import { computeWorkedMinutes, formatTimeHm, formatWorkedMinutes } from "@/lib/workedHours";
import { cn } from "@/lib/utils";

type ChecklistItem = { id: string; label: string };

type ReportStep = "report" | "like";

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
  inlineTrigger = false
}: {
  shiftId: string;
  headline: string;
  /** В строке «Смена идёт» — без absolute, чтобы не накладывалось на бейдж */
  inlineTrigger?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ReportStep>("report");
  const [text, setText] = useState("");
  const [workStartTime, setWorkStartTime] = useState("");
  const [workEndTime, setWorkEndTime] = useState("");
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
  const [endTimeEdited, setEndTimeEdited] = useState(false);

  const getEffectiveWorkEndTime = () => (endTimeEdited ? workEndTime : formatTimeHm(new Date()));

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
    setEndTimeEdited(false);
    setWorkStartTime("");
    setWorkEndTime("");
    void (async () => {
      try {
        const [list, checklist, times] = await Promise.all([
          getShiftCoworkersForLike(shiftId),
          getShiftChecklistForReport(shiftId),
          getShiftReportTimes(shiftId)
        ]);
        if (!cancelled) {
          setCoworkers(list);
          setChecklistItems(checklist);
          setChecklistChecked(Object.fromEntries(checklist.map((item) => [item.id, false])));
          setWorkStartTime(times.workStartTime);
          setWorkEndTime(formatTimeHm(new Date()));
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setCoworkers([]);
          setChecklistItems([]);
          setError(err instanceof Error ? err.message : "Не удалось загрузить данные смены.");
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
    setStep("report");
    setError("");
    setText("");
    setWorkStartTime("");
    setWorkEndTime("");
    setEndTimeEdited(false);
    setLikedUserId(null);
    setChecklistChecked({});
    resetPhoto();
  };

  const validateReportFields = () => {
    const effectiveEndTime = getEffectiveWorkEndTime();
    if (!endTimeEdited) {
      setWorkEndTime(effectiveEndTime);
    }
    if (text.trim().length < 5) {
      setError("Напишите чуть подробнее — минимум 5 символов.");
      return false;
    }
    if (!workStartTime || !effectiveEndTime) {
      setError("Укажите время начала и окончания работы.");
      return false;
    }
    if (!workplacePhotoPath) {
      setError("Добавьте фото рабочего места перед отправкой.");
      return false;
    }
    return true;
  };

  const submitReport = (likeId: string | null) => {
    const effectiveEndTime = getEffectiveWorkEndTime();
    if (!endTimeEdited) {
      setWorkEndTime(effectiveEndTime);
    }
    start(async () => {
      try {
        await submitShiftReport({
          shiftId,
          text,
          workplacePhotoPath,
          workStartTime,
          workEndTime: effectiveEndTime,
          ...(likeId ? { likedUserId: likeId } : {}),
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
  };

  const goToLikeStep = () => {
    setError("");
    if (!validateReportFields()) return;
    setLikedUserId(null);
    setStep("like");
  };

  const handleReportStepPrimary = () => {
    if (!validateReportFields()) return;
    if (coworkersLoading || coworkers.length > 0) {
      goToLikeStep();
      return;
    }
    submitReport(null);
  };

  const workedPreview = (() => {
    const effectiveEndTime = getEffectiveWorkEndTime();
    if (!workStartTime || !effectiveEndTime) return null;
    try {
      return formatWorkedMinutes(computeWorkedMinutes(workStartTime, effectiveEndTime));
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

  const reportActions = (
    <div className="grid w-full grid-cols-2 gap-3 [grid-template-columns:repeat(2,minmax(0,1fr))]">
      <button type="button" className="btn-secondary w-full min-h-11 touch-manipulation" disabled={pending || photoUploading} onClick={close}>
        Отменить
      </button>
      <button
        type="submit"
        className="btn-primary w-full min-h-11 touch-manipulation"
        disabled={pending || photoUploading || !workplacePhotoPath}
      >
        {pending ? "Отправляем…" : coworkersLoading || coworkers.length > 0 ? "Далее" : "Завершить"}
      </button>
    </div>
  );

  const likeActions = (
    <div className="grid w-full grid-cols-2 gap-3 [grid-template-columns:repeat(2,minmax(0,1fr))]">
      <button
        type="button"
        className="btn-secondary w-full min-h-11 touch-manipulation"
        disabled={pending}
        onClick={() => {
          setError("");
          setStep("report");
        }}
      >
        Назад
      </button>
      <button
        type="button"
        className="btn-primary w-full min-h-11 touch-manipulation"
        disabled={pending || coworkersLoading}
        onClick={() => submitReport(likedUserId)}
      >
        {pending ? "Отправляем…" : likedUserId ? "Отправить" : "Пропустить"}
      </button>
    </div>
  );

  const overlay =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[220] flex flex-col bg-background sm:items-center sm:justify-center sm:bg-background/80 sm:p-4 sm:backdrop-blur-[2px]"
            role="presentation"
            style={{ overscrollBehavior: "contain" }}
            onClick={() => !pending && close()}
          >
            <div
              className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-border bg-background sm:max-h-[min(90dvh,640px)] sm:max-w-lg sm:flex-none sm:rounded-lg sm:border"
              role="dialog"
              aria-modal
              aria-labelledby="shift-report-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-border/80 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
                <p id="shift-report-title" className="text-base font-medium tracking-tight">
                  {step === "like" ? "Отметить коллегу" : "Отчёт по смене"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {step === "like"
                    ? "Можно выбрать одного человека или пропустить. Лайк анонимный."
                    : headline}
                </p>
                {step === "report" && (coworkersLoading || coworkers.length > 0) ? (
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-display text-muted">Шаг 1 из 2</p>
                ) : null}
                {step === "like" ? (
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-display text-muted">Шаг 2 из 2</p>
                ) : null}
              </div>

              {step === "report" ? (
              <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleReportStepPrimary();
                }}
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label className="mb-2 block text-sm font-medium text-foreground" htmlFor={`work-start-${shiftId}`}>
                        Начало работы
                      </label>
                      <input
                        id={`work-start-${shiftId}`}
                        type="time"
                        className="input-time input-time-readonly"
                        value={workStartTime}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        required
                      />
                      <p className="mt-1 text-[11px] text-muted">По QR-отметке на смене</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="mb-2 block text-sm font-medium text-foreground" htmlFor={`work-end-${shiftId}`}>
                        Конец работы
                      </label>
                      <input
                        id={`work-end-${shiftId}`}
                        type="time"
                        className="input-time"
                        value={workEndTime}
                        onChange={(e) => {
                          setEndTimeEdited(true);
                          setWorkEndTime(e.target.value);
                          setError("");
                        }}
                        disabled={pending || checklistLoading || coworkersLoading}
                        required
                      />
                      <p className="mt-1 text-[11px] text-muted">
                        {endTimeEdited ? "Изменено вручную" : "Подставится при отправке"}
                      </p>
                    </div>
                  </div>
                  <p className="min-h-5 text-sm text-muted">
                    {workedPreview ? (
                      <>
                        Отработано: <span className="font-semibold text-foreground">{workedPreview}</span>
                      </>
                    ) : null}
                  </p>
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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className="btn-secondary inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2"
                      disabled={pending || photoUploading}
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera size={16} aria-hidden />
                      {photoUploading ? "Загружаем…" : "Сфоткать"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2"
                      disabled={pending || photoUploading}
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      <ImagePlus size={16} aria-hidden />
                      Из галереи
                    </button>
                    {workplacePhotoPath ? (
                      <span className="text-xs text-muted sm:col-span-2">Фото загружено</span>
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
                    <ul className="space-y-1.5">
                      {checklistItems.map((item) => (
                        <li key={item.id}>
                          <label className="grid cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-3 text-sm">
                            <input
                              type="checkbox"
                              className="size-[1.125rem] shrink-0 rounded-sm border border-border accent-accent"
                              checked={Boolean(checklistChecked[item.id])}
                              disabled={pending}
                              onChange={(e) => {
                                setChecklistChecked((prev) => ({ ...prev, [item.id]: e.target.checked }));
                                setError("");
                              }}
                            />
                            <span className="leading-snug">{item.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}
                </div>

                <div className="shrink-0 border-t border-border/80 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  {reportActions}
                </div>
              </form>
              ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
                {coworkersLoading ? (
                  <p className="py-8 text-center text-sm text-muted">Загружаем коллег на смене…</p>
                ) : coworkers.length > 0 ? (
                  <div className="space-y-3 rounded-lg border border-border/80 bg-foreground/[0.02] px-3 py-4">
                    <div className="flex items-start gap-2">
                      <Heart className="mt-0.5 h-5 w-5 shrink-0 text-highlight" aria-hidden />
                      <p className="text-sm text-muted">Кого отметить за хорошую работу на смене?</p>
                    </div>
                    <ul className="flex flex-col gap-2">
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
                                "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                                selected
                                  ? "border-highlight/50 bg-highlight/15"
                                  : "border-border/70 bg-background/60 hover:bg-foreground/[0.04]"
                              )}
                            >
                              <UserAvatar
                                name={coworker.name}
                                photoUrl={coworker.telegramPhotoUrl}
                                color={coworker.color}
                                size="md"
                              />
                              <span className="min-w-0 flex-1 font-semibold">{coworker.name}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted">Сегодня на смене нет других сотрудников.</p>
                )}

                {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}
                </div>

                <div className="shrink-0 border-t border-border/80 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  {likeActions}
                </div>
              </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex shrink-0 touch-manipulation items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-foreground/[0.06]",
          inlineTrigger
            ? "min-h-11 min-w-11"
            : "absolute bottom-3 right-3 z-10 min-h-11 min-w-11"
        )}
        aria-label="Сдать отчёт по смене"
        onClick={() => setOpen(true)}
      >
        <ClipboardCheck size={18} className="shrink-0" aria-hidden />
      </button>

      {overlay}
    </>
  );
}
