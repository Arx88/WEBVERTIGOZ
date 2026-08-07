"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Download, FileText, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function WizardStepHandbook() {
  const { data, updateData } = useWizard();
  const [downloading, setDownloading] = useState(false);
  const isDownloaded = data.handbookDownloadedAt !== null;

  async function handleDownload() {
    setDownloading(true);
    try {
      // TODO: replace with real handbook URL from admin config
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
    <div className="max-w-xl mx-auto space-y-6 text-center">
      <p className="wiz-body max-w-lg mx-auto">
        Antes de aceptar los términos, debés descargar y leer el{" "}
        <strong>Handbook oficial del torneo VÉRTIGO</strong>. Contiene el
        reglamento completo, las mecánicas de sorteo, los comodines, las reglas
        de conducta y los protocolos de disputa.
      </p>

      {/* Card del handbook */}
      <div
        className={cn(
          "p-8 flex flex-col items-center text-center transition-all",
          isDownloaded
            ? "bg-[rgba(255,46,158,0.04)] border border-[rgba(255,46,158,0.6)] shadow-[0_0_22px_rgba(255,46,158,0.18)]"
            : "wiz-panel"
        )}
      >
        <div
          className={cn(
            "w-20 h-20 rounded-full border flex items-center justify-center mb-4",
            isDownloaded
              ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_18px_rgba(255,46,158,0.45)]"
              : "border-[rgba(255,46,158,0.4)] text-[rgba(255,180,220,0.65)]"
          )}
        >
          {isDownloaded ? (
            <Check className="w-10 h-10" strokeWidth={1.5} />
          ) : (
            <FileText className="w-10 h-10" strokeWidth={1.25} />
          )}
        </div>

        <div className="font-cinzel text-xl tracking-[0.08em] uppercase text-[#f5eaff] mb-2">
          Handbook VÉRTIGO
        </div>
        <div className="wiz-caption mb-6" style={{ letterSpacing: "0.32em" }}>
          Reglamento oficial · PDF · ~2MB
        </div>

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

        {isDownloaded && (
          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 border-y border-[rgba(255,46,158,0.5)] bg-[rgba(255,46,158,0.06)]">
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

      {/* Advertencia */}
      <div className="wiz-panel border-l-2 border-l-[#ff2e9e] px-4 py-3 text-left max-w-lg mx-auto">
        <p className="text-[13px] leading-relaxed text-[#e6d3f5] mb-2">
          <span className="text-[#ff2e9e] font-semibold">Importante:</span> el
          botón &ldquo;Siguiente&rdquo; se habilitará únicamente después de
          descargar el handbook. Se asume que al avanzar, los 3 jugadores del
          equipo han leído el reglamento completo.
        </p>
        <p className="wiz-caption normal-case text-[11px] text-[rgba(255,180,220,0.45)]" style={{ letterSpacing: "0.04em" }}>
          Si el handbook no está disponible aún, contactá al staff del torneo.
        </p>
      </div>
    </div>
  );
}
