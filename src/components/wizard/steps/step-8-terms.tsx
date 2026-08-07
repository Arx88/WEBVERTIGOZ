"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Radio, ShieldAlert, Eye, Twitch, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function WizardStepTerms() {
  const { data, updateData } = useWizard();
  const [restreamChecked, setRestreamChecked] = useState(data.restreamAccepted);
  const [termsChecked, setTermsChecked] = useState(data.termsAcceptedAt !== null);

  function handleRestreamToggle() {
    const newValue = !restreamChecked;
    setRestreamChecked(newValue);
    updateData({ restreamAccepted: newValue });
  }

  function handleTermsToggle() {
    const newValue = !termsChecked;
    setTermsChecked(newValue);
    if (newValue) {
      updateData({ termsAcceptedAt: new Date() });
    } else {
      updateData({ termsAcceptedAt: null });
    }
  }

  const canProceed = restreamChecked && termsChecked;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <p className="text-text-secondary text-sm font-light leading-relaxed">
        Para completar la inscripción, los 3 jugadores del equipo deben aceptar
        los siguientes términos. El capitán confirma en nombre de todos los
        integrantes del equipo.
      </p>

      {/* Término 1: Restream permission */}
      <div className={cn(
        "border p-5 transition-colors",
        restreamChecked ? "border-gold/60 bg-gold/5" : "border-border-subtle"
      )}>
        <div className="flex items-start gap-4">
          <button
            onClick={handleRestreamToggle}
            className={cn(
              "w-6 h-6 border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5",
              restreamChecked
                ? "border-gold bg-gold text-bg"
                : "border-border-strong hover:border-text-secondary"
            )}
            aria-label="Aceptar restream"
          >
            {restreamChecked && <Check className="w-4 h-4" strokeWidth={2.5} />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-gold" strokeWidth={1.5} />
              <span className="font-serif text-lg">Permiso de transmisión</span>
            </div>
            <p className="text-text-secondary text-sm font-light leading-relaxed mb-3">
              Acepto que mis partidas en el torneo VÉRTIGO puedan ser transmitidas
              en vivo por los canales oficiales del torneo (Twitch, YouTube, Kick)
              y por casters community autorizados por el staff. Los casts pueden
              incluir mi perfil de AoE2 Companion, mis estadísticas y comentarios
              sobre mi desempeño.
            </p>
            <div className="flex items-center gap-3 text-caption text-text-tertiary">
              <Twitch className="w-3.5 h-3.5" strokeWidth={1.5} />
              <Youtube className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Canales oficiales + casters community</span>
            </div>
          </div>
        </div>
      </div>

      {/* Término 2: Reglamento */}
      <div className={cn(
        "border p-5 transition-colors",
        termsChecked ? "border-gold/60 bg-gold/5" : "border-border-subtle"
      )}>
        <div className="flex items-start gap-4">
          <button
            onClick={handleTermsToggle}
            className={cn(
              "w-6 h-6 border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5",
              termsChecked
                ? "border-gold bg-gold text-bg"
                : "border-border-strong hover:border-text-secondary"
            )}
            aria-label="Aceptar reglamento"
          >
            {termsChecked && <Check className="w-4 h-4" strokeWidth={2.5} />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-gold" strokeWidth={1.5} />
              <span className="font-serif text-lg">Reglamento del torneo</span>
            </div>
            <p className="text-text-secondary text-sm font-light leading-relaxed mb-3">
              Confirmo que los 3 jugadores del equipo hemos leído el Handbook
              oficial del torneo VÉRTIGO (descargado en el paso anterior) y
              aceptamos cumplir con todas las reglas, mecánicas de sorteo, uso de
              comodines, código de conducta y protocolos de disputa descritos en
              el reglamento.
            </p>
            <p className="text-text-secondary text-sm font-light leading-relaxed mb-3">
              Entendemos que el incumplimiento del reglamento puede resultar en
              sanciones, descalificación del equipo o prohibición de participar
              en futuras ediciones del torneo.
            </p>
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Handbook descargado: {data.handbookDownloadedAt?.toLocaleString("es-AR")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Estado */}
      <div className="border-l-2 border-gold/40 pl-4 py-2">
        {canProceed ? (
          <p className="text-caption text-success leading-relaxed">
            ✓ Ambos términos aceptados. Ya podés revisar y confirmar tu inscripción.
          </p>
        ) : (
          <p className="text-caption text-text-tertiary leading-relaxed">
            Aceptá los dos términos para continuar con la confirmación final.
          </p>
        )}
      </div>
    </div>
  );
}
