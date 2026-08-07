"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      // Por ahora, simulación
      await new Promise((r) => setTimeout(r, 800));

      // Crear un link temporal y descargar
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
    <div className="max-w-2xl mx-auto space-y-8">
      <p className="text-text-secondary text-sm font-light leading-relaxed">
        Antes de aceptar los términos del torneo, debés descargar y leer el
        Handbook oficial del torneo VÉRTIGO. Contiene el reglamento completo,
        las mecánicas de sorteo, los comodines, las reglas de conducta y los
        protocolos de disputa.
      </p>

      {/* Card del handbook */}
      <div className={cn(
        "border p-6 flex flex-col items-center text-center transition-colors",
        isDownloaded ? "border-gold/60 bg-gold/5" : "border-border-subtle bg-bg-elevated"
      )}>
        <div className={cn(
          "w-20 h-20 rounded-full border-2 flex items-center justify-center mb-4",
          isDownloaded ? "border-gold text-gold" : "border-border-strong text-text-secondary"
        )}>
          {isDownloaded ? (
            <Check className="w-10 h-10" strokeWidth={1.5} />
          ) : (
            <FileText className="w-10 h-10" strokeWidth={1.25} />
          )}
        </div>

        <div className="font-serif text-2xl mb-2">Handbook VÉRTIGO</div>
        <div className="text-caption text-text-tertiary uppercase tracking-wider mb-5">
          Reglamento oficial · PDF · ~2MB
        </div>

        <Button
          variant={isDownloaded ? "secondary" : "premium"}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isDownloaded ? "Volver a descargar" : "Descargar handbook"}
        </Button>

        {isDownloaded && (
          <Badge variant="success" className="mt-4">
            <Check className="w-3 h-3 mr-1" strokeWidth={2} />
            Descargado · {data.handbookDownloadedAt?.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </Badge>
        )}
      </div>

      {/* Advertencia */}
      <div className="border-l-2 border-gold/40 pl-4 py-2 space-y-2">
        <p className="text-caption text-text-secondary leading-relaxed">
          <span className="text-gold">Importante:</span> el botón "Siguiente" se
          habilitará únicamente después de descargar el handbook. Se asume que al
          avanzar al siguiente paso, los 3 jugadores del equipo han leído el
          reglamento completo.
        </p>
        <p className="text-caption text-text-tertiary">
          Si el handbook no está disponible aún, contactá al staff del torneo.
        </p>
      </div>
    </div>
  );
}
