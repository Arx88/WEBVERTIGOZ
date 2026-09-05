"use client";

/**
 * ExportCsv — descarga real del tab visible de auditoría.
 * Arma el CSV en el cliente (con escape de comillas/enteros) y lo
 * descarga vía Blob URL. Reemplaza al stub href="#" anterior.
 */

import { Download } from "lucide-react";

interface ExportCsvProps {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  // Escape mínimo de RFC 4180: comillas dobles y separadores
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function ExportCsv({ filename, headers, rows }: ExportCsvProps) {
  const onDownload = () => {
    const lines = [
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={onDownload} className="vertigo-btn vertigo-btn-ghost">
      <Download style={{ width: 14, height: 14 }} />
      Export CSV
    </button>
  );
}
