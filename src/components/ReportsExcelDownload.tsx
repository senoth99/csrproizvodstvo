"use client";

import { Download } from "lucide-react";

export function ReportsExcelDownload() {
  return (
    <a
      href="/api/export/reports.xlsx"
      className="btn-secondary inline-flex items-center gap-2"
      download
    >
      <Download size={16} aria-hidden />
      Скачать Excel
    </a>
  );
}
