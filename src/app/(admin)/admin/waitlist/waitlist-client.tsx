"use client";

import { useMemo, useState } from "react";
import { Download, Copy, Check, Mail } from "lucide-react";

export interface WaitlistRow {
  id: string;
  email: string;
  source: string;
  notifiedAt: string | null;
  createdAt: string;
  editionId: string | null;
  editionName: string;
  editionStatus: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

const SOURCE_LABEL: Record<string, string> = {
  wizard_freno: "Freno del wizard",
};

export default function WaitlistTable({ rows }: { rows: WaitlistRow[] }) {
  const [copied, setCopied] = useState(false);
  const editions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (r.editionId) seen.set(r.editionId, r.editionName);
    return [...seen.entries()];
  }, [rows]);

  const [editionFilter, setEditionFilter] = useState<string>("all");
  const filtered = editionFilter === "all" ? rows : rows.filter((r) => r.editionId === editionFilter);

  async function copyEmails() {
    const text = [...new Set(filtered.map((r) => r.email))].join(", ");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard bloqueado: sin efecto */
    }
  }

  function exportCsv() {
    const header = "email,edicion,estado_edicion,fuente,anotado,notificado";
    const lines = filtered.map((r) =>
      [r.email, r.editionName, r.editionStatus, r.source, fmtDate(r.createdAt), r.notifiedAt ? fmtDate(r.notifiedAt) : ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob(["\uFEFF" + [header, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "waitlist-vertigocup.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {editions.length > 1 && (
          <select
            value={editionFilter}
            onChange={(e) => setEditionFilter(e.target.value)}
            className="h-[42px] rounded-[10px] border border-[var(--vertigo-input-border)] bg-[var(--vertigo-input-bg)] px-3 text-sm text-[var(--vertigo-text)] outline-none"
          >
            <option value="all">Todas las ediciones</option>
            {editions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={copyEmails} className="vertigo-btn">
            {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
            {copied ? "Copiados" : "Copiar emails"}
          </button>
          <button type="button" onClick={exportCsv} className="vertigo-btn">
            <Download style={{ width: 14, height: 14 }} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="vertigo-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--vertigo-line-soft)] text-[10px] font-bold uppercase tracking-[2px] text-[#8f86a3]">
              <th className="px-5 py-3.5">Email</th>
              <th className="px-5 py-3.5">Edición</th>
              <th className="px-5 py-3.5">Fuente</th>
              <th className="px-5 py-3.5">Anotado</th>
              <th className="px-5 py-3.5">Notificado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-[var(--vertigo-line-soft)] last:border-0 hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2 text-[var(--vertigo-text)]">
                    <Mail style={{ width: 13, height: 13, color: "var(--vertigo-faint)", flex: "none" }} />
                    {r.email}
                  </span>
                </td>
                <td className="px-5 py-3 text-[var(--vertigo-muted)]">{r.editionName}</td>
                <td className="px-5 py-3 text-[var(--vertigo-faint)]">{SOURCE_LABEL[r.source] ?? r.source}</td>
                <td className="px-5 py-3 text-[var(--vertigo-faint)]">{fmtDate(r.createdAt)}</td>
                <td className="px-5 py-3">
                  {r.notifiedAt ? (
                    <span className="vertigo-badge vertigo-badge-success">Avisado {fmtDate(r.notifiedAt)}</span>
                  ) : (
                    <span className="vertigo-badge vertigo-badge-warning">Pendiente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
