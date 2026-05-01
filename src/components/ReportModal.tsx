"use client";

import { useState, useTransition } from "react";
import { SendHorizontal } from "lucide-react";
import { submitShiftReport } from "@/app/actions";

export function ReportModal({ shiftId }: { shiftId: string }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="card space-y-2"
      action={() =>
        start(async () => {
          setError("");
          try {
            await submitShiftReport({ shiftId, text });
            setText("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка отправки отчета");
          }
        })
      }
    >
      <h3 className="font-semibold">Отчет по смене</h3>
      <textarea className="min-h-28 w-full" value={text} onChange={(e) => setText(e.target.value)} placeholder="Коротко опишите, что сделали за смену" />
      <button className="btn-primary inline-flex items-center justify-center gap-2" disabled={pending || !text.trim()}>
        <SendHorizontal size={16} />
        {pending ? "Отправляем..." : "Отправить отчет"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
