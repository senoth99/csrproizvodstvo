"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyShiftReport } from "@/app/actions";
import { computeWorkedMinutes, formatWorkedMinutes } from "@/lib/workedHours";

export function ReportTextEditor({
  reportId,
  initialText,
  initialWorkStartTime = "",
  initialWorkEndTime = "",
  canEdit
}: {
  reportId: string;
  initialText: string;
  initialWorkStartTime?: string;
  initialWorkEndTime?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [workStartTime, setWorkStartTime] = useState(initialWorkStartTime);
  const [workEndTime, setWorkEndTime] = useState(initialWorkEndTime);
  const [savedWorkStart, setSavedWorkStart] = useState(initialWorkStartTime);
  const [savedWorkEnd, setSavedWorkEnd] = useState(initialWorkEndTime);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    setSavedText(initialText);
    setText(initialText);
    setWorkStartTime(initialWorkStartTime);
    setWorkEndTime(initialWorkEndTime);
    setSavedWorkStart(initialWorkStartTime);
    setSavedWorkEnd(initialWorkEndTime);
  }, [initialText, initialWorkStartTime, initialWorkEndTime]);

  const workedPreview = (() => {
    if (!workStartTime || !workEndTime) return null;
    try {
      return formatWorkedMinutes(computeWorkedMinutes(workStartTime, workEndTime));
    } catch {
      return null;
    }
  })();

  if (!canEdit) {
    return (
      <div className="rounded-lg border-b border-border bg-transparent pb-3 pt-1">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{savedText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border-b border-border bg-transparent pb-3 pt-1">
      {editing ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`edit-work-start-${reportId}`}>
                Начало работы
              </label>
              <input
                id={`edit-work-start-${reportId}`}
                type="time"
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
                disabled={pending}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`edit-work-end-${reportId}`}>
                Конец работы
              </label>
              <input
                id={`edit-work-end-${reportId}`}
                type="time"
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
                disabled={pending}
              />
            </div>
            {workedPreview ? (
              <p className="col-span-2 text-xs text-muted">
                Отработано: <span className="font-semibold text-foreground">{workedPreview}</span>
              </p>
            ) : null}
          </div>
          <textarea
            className="min-h-32 w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none focus-visible:outline-none"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            disabled={pending}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() => {
                setError("");
                if (text.trim().length < 5) {
                  setError("Напишите чуть подробнее — минимум 5 символов.");
                  return;
                }
                if (!workStartTime || !workEndTime) {
                  setError("Укажите время начала и окончания работы.");
                  return;
                }
                start(async () => {
                  try {
                    await updateMyShiftReport({
                      reportId,
                      text,
                      workStartTime,
                      workEndTime
                    });
                    setSavedText(text);
                    setSavedWorkStart(workStartTime);
                    setSavedWorkEnd(workEndTime);
                    setEditing(false);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Не удалось обновить отчёт.");
                  }
                });
              }}
            >
              {pending ? "Сохраняем…" : "Сохранить"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => {
                setText(savedText);
                setWorkStartTime(savedWorkStart);
                setWorkEndTime(savedWorkEnd);
                setEditing(false);
                setError("");
              }}
            >
              Отмена
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{savedText}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setText(savedText);
              setWorkStartTime(savedWorkStart);
              setWorkEndTime(savedWorkEnd);
              setEditing(true);
              setError("");
            }}
          >
            Редактировать отчёт
          </button>
        </>
      )}
      {error ? <p className="text-sm font-medium text-foreground/85">{error}</p> : null}
    </div>
  );
}
