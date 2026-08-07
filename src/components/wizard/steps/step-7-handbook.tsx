"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Download, FileText, Check, Loader2, Info, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

// ============================================================
// Step 7 — Handbook
// Layout: card central con brand identity
// ============================================================

export default function WizardStepHandbook() {
  const { data, updateData } = useWizard();
  const [downloading, setDownloading] = useState(false);
  const isDownloaded = data.handbookDownloadedAt !== null;

  async function handleDownload() {
    setDownloading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));

      const link = document.createElement("a");
      link.href = "/handbook/VERTIGO-Handbook.pdf";
      link.download = "VERTIGO-Handbook.pdf";
      link.click();

      updateData({ handbookDownloadedAt: new Date() });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[1fr_1fr] gap-6 items-center max-w-4xl mx-auto">
      {/* ====== LEFT — Brand/info side ====== */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#ff2e9e]" strokeWidth={1.5} />
          <span className="wiz-section-eyebrow">
            Reglamento oficial
          </span>
        </div>

        <p className="wiz-body">
          Antes de aceptar los términos, debés descargar y leer el{" "}
          <strong>Handbook oficial del torneo VÉRTIGO</strong>. Contiene el
          reglamento completo, las mecánicas de sorteo, los comodines, las reglas
          de conducta y los protocolos de disputa.
        </p>

        {/* Index/contents */}
        <div className="wiz-panel-sunken p-4 rounded-[4px]">
          <div className="wiz-caption text-[10px] mb-3" style={{ letterSpacing: "0.32em" }}>
            Contenido del handbook
          </div>
          <ul className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px]">
            {[
              "Formato del torneo",
              "Mecánicas de sorteo",
              "Cartas de poder",
              "Comodines",
              "Código de conducta",
              "Penalizaciones",
              "Protocolos de disputa",
              "Schedule y jornadas",
            ].map((item, idx) => (
              <li key={idx} className="flex items-baseline gap-2">
                <span className="font-cinzel text-[9px] tabular-nums text-[rgba(255,46,158,0.6)] w-4">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="font-inter text-[#e6d3f5]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="wiz-panel-sunken border-l-2 !border-l-[#ff2e9e] px-4 py-3 rounded-[4px] flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-[#ff2e9e] mt-0.5 shrink-0" strokeWidth={1.5} />
          <p className="wiz-body text-[12px]">
            El botón &ldquo;Siguiente&rdquo; se habilitará únicamente después de descargar el handbook. Se asume que los 3 jugadores del equipo han leído el reglamento completo.
          </p>
        </div>
      </div>

      {/* ====== RIGHT — Handbook card ====== */}
      <div
        className={cn(
          "wiz-card !rounded-[4px] p-8 flex flex-col items-center text-center transition-all",
          isDownloaded && "wiz-card-active"
        )}
      >
        {/* Emblem header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative w-8 h-8 rotate-45 border border-[rgba(255,46,158,0.7)] flex items-center justify-center shadow-[0_0_14px_rgba(255,46,158,0.35)]">
            <span className="-rotate-45 font-cinzel text-[#ff2e9e] text-xs font-bold">V</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-cinzel text-[11px] tracking-[0.32em] uppercase text-[#f5eaff]">
              Vértigo
            </span>
            <span className="font-inter text-[8px] tracking-[0.22em] uppercase text-[rgba(255,180,220,0.55)] mt-1">
              Cup · 3a Edición
            </span>
          </div>
        </div>

        {/* Big icon */}
        <div
          className={cn(
            "w-24 h-24 rounded-full border flex items-center justify-center mb-5 transition-all",
            isDownloaded
              ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_22px_rgba(255,46,158,0.5)]"
              : "border-[rgba(255,46,158,0.4)] text-[rgba(255,180,220,0.65)]"
          )}
        >
          {isDownloaded ? (
            <Check className="w-12 h-12" strokeWidth={1.5} />
          ) : (
            <FileText className="w-12 h-12" strokeWidth={1.25} />
          )}
        </div>

        {/* Title */}
        <div className="font-cinzel text-[22px] tracking-[0.06em] uppercase text-[#f5eaff] mb-2">
          Handbook Vértigo
        </div>
        <div className="wiz-caption mb-6" style={{ letterSpacing: "0.32em" }}>
          PDF · ~2 MB · 24 páginas
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={cn(isDownloaded ? "wiz-btn-ghost" : "wiz-btn-primary")}
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Download className="w-4 h-4" strokeWidth={1.5} />
          )}
          {isDownloaded ? "Volver a descargar" : "Descargar handbook"}
        </button>

        {/* Downloaded badge */}
        {isDownloaded && (
          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 border-y border-[rgba(255,46,158,0.5)] bg-[rgba(255,46,158,0.06)] rounded-[2px]">
            <Check className="w-3 h-3 text-[#ff2e9e]" strokeWidth={2} />
            <span className="font-cinzel text-[10px] tracking-[0.18em] uppercase text-[#ff2e9e]">
              Descargado ·{" "}
              {data.handbookDownloadedAt?.toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
