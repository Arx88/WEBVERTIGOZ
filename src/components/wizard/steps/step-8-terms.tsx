"use client";

import { useWizard } from "@/components/wizard/wizard-context";
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
    <div className="max-w-2xl mx-auto space-y-5 text-center">
      <p className="wiz-body max-w-xl mx-auto">
        Para completar la inscripción, los 3 jugadores del equipo deben aceptar
        los siguientes términos. El capitán confirma en nombre de todos.
      </p>

      {/* Término 1: Restream permission */}
      <div
        className={cn(
          "p-5 transition-all text-left",
          restreamChecked
            ? "bg-[rgba(255,46,158,0.04)] border border-[rgba(255,46,158,0.5)] shadow-[0_0_18px_rgba(255,46,158,0.12)]"
            : "wiz-panel"
        )}
      >
        <div className="flex items-start gap-4">
          <button
            onClick={handleRestreamToggle}
            className={cn("wiz-check mt-0.5", restreamChecked && "wiz-check-checked")}
            aria-label="Aceptar restream"
          >
            {restreamChecked && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-[#ff2e9e]" strokeWidth={1.5} />
              <span className="font-cinzel text-base tracking-[0.06em] uppercase text-[#f5eaff]">
                Permiso de transmisión
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-[#e6d3f5] mb-3">
              Acepto que mis partidas en el torneo VÉRTIGO puedan ser transmitidas
              en vivo por los canales oficiales (Twitch, YouTube, Kick) y por
              casters community autorizados por el staff. Los casts pueden incluir
              mi perfil de AoE2 Companion, mis estadísticas y comentarios sobre mi
              desempeño.
            </p>
            <div className="flex items-center gap-3 wiz-caption text-[10px]" style={{ letterSpacing: "0.18em" }}>
              <Twitch className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)]" strokeWidth={1.5} />
              <Youtube className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)]" strokeWidth={1.5} />
              <span className="normal-case" style={{ letterSpacing: "0.04em" }}>
                Canales oficiales + casters community
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Término 2: Reglamento */}
      <div
        className={cn(
          "p-5 transition-all text-left",
          termsChecked
            ? "bg-[rgba(255,46,158,0.04)] border border-[rgba(255,46,158,0.5)] shadow-[0_0_18px_rgba(255,46,158,0.12)]"
            : "wiz-panel"
        )}
      >
        <div className="flex items-start gap-4">
          <button
            onClick={handleTermsToggle}
            className={cn("wiz-check mt-0.5", termsChecked && "wiz-check-checked")}
            aria-label="Aceptar reglamento"
          >
            {termsChecked && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-[#ff2e9e]" strokeWidth={1.5} />
              <span className="font-cinzel text-base tracking-[0.06em] uppercase text-[#f5eaff]">
                Reglamento del torneo
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-[#e6d3f5] mb-3">
              Confirmo que los 3 jugadores del equipo hemos leído el Handbook
              oficial (descargado en el paso anterior) y aceptamos cumplir con
              todas las reglas, mecánicas de sorteo, uso de comodines, código de
              conducta y protocolos de disputa.
            </p>
            <p className="text-[13px] leading-relaxed text-[#e6d3f5] mb-3">
              Entendemos que el incumplimiento puede resultar en sanciones,
              descalificación del equipo o prohibición de participar en futuras
              ediciones.
            </p>
            <div className="flex items-center gap-2 wiz-caption text-[10px]" style={{ letterSpacing: "0.18em" }}>
              <Eye className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)]" strokeWidth={1.5} />
              <span className="normal-case" style={{ letterSpacing: "0.04em" }}>
                Handbook descargado: {data.handbookDownloadedAt?.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Estado */}
      <div className="wiz-panel border-l-2 border-l-[#ff2e9e] px-4 py-3 inline-block">
        {canProceed ? (
          <p className="text-[13px] leading-relaxed text-[#e6d3f5]">
            <Check className="w-4 h-4 inline mr-2 text-[#ff2e9e]" strokeWidth={2} />
            Ambos términos aceptados. Ya podés revisar y confirmar tu inscripción.
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-[rgba(255,180,220,0.55)]">
            Aceptá los dos términos para continuar con la confirmación final.
          </p>
        )}
      </div>
    </div>
  );
}
