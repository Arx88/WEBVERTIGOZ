"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Check, Radio, ShieldAlert, Eye, Twitch, Youtube, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

// ============================================================
// Step 8 — Términos
// Layout: 2 cards en row (Restream + Reglamento) + estado al pie
// ============================================================

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
    <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full">
      <p className="wiz-body max-w-2xl mx-auto text-center">
        Para completar la inscripción, los 3 jugadores del equipo deben aceptar
        los siguientes términos. El capitán confirma en nombre de todos.
      </p>

      {/* ====== 2 cards in row ====== */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Card 1: Restream permission */}
        <article
          className={cn(
            "wiz-card !rounded-[4px] p-5 transition-all",
            restreamChecked && "wiz-card-active"
          )}
        >
          {/* Header */}
          <div className="flex items-start gap-3 pb-3 border-b border-[rgba(255,46,158,0.1)] mb-3">
            <div
              className={cn(
                "w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                restreamChecked
                  ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_12px_rgba(255,46,158,0.35)]"
                  : "border-[rgba(255,46,158,0.35)] text-[rgba(255,180,220,0.55)]"
              )}
            >
              <Radio className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="wiz-caption text-[9px] mb-1" style={{ letterSpacing: "0.32em" }}>
                Término 01 · Restream
              </div>
              <div className="font-cinzel text-[15px] tracking-[0.06em] uppercase text-[#f5eaff]">
                Permiso de transmisión
              </div>
            </div>
          </div>

          {/* Body */}
          <p className="wiz-body text-[12px] mb-3">
            Acepto que mis partidas en el torneo VÉRTIGO puedan ser transmitidas
            en vivo por los canales oficiales (Twitch, YouTube, Kick) y por
            casters community autorizados por el staff. Los casts pueden incluir
            mi perfil de AoE2 Companion, mis estadísticas y comentarios sobre mi
            desempeño.
          </p>

          {/* Channels */}
          <div className="flex items-center gap-2 mb-4">
            <Twitch className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)]" strokeWidth={1.5} />
            <Youtube className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)]" strokeWidth={1.5} />
            <span className="wiz-meta text-[10px] normal-case">
              Canales oficiales + casters community
            </span>
          </div>

          {/* Toggle */}
          <button
            onClick={handleRestreamToggle}
            className="w-full flex items-center gap-3 pt-3 border-t border-[rgba(255,46,158,0.08)] text-left"
          >
            <span
              className={cn("wiz-check", restreamChecked && "wiz-check-checked")}
              role="checkbox"
              aria-checked={restreamChecked}
              aria-label="Aceptar restream"
            >
              {restreamChecked && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
            </span>
            <span className={cn(
              "font-cinzel text-[11px] tracking-[0.22em] uppercase transition-colors",
              restreamChecked ? "text-[#ff2e9e]" : "text-[rgba(255,180,220,0.55)]"
            )}>
              {restreamChecked ? "Aceptado" : "Acepto el permiso de transmisión"}
            </span>
          </button>
        </article>

        {/* Card 2: Reglamento */}
        <article
          className={cn(
            "wiz-card !rounded-[4px] p-5 transition-all",
            termsChecked && "wiz-card-active"
          )}
        >
          {/* Header */}
          <div className="flex items-start gap-3 pb-3 border-b border-[rgba(255,46,158,0.1)] mb-3">
            <div
              className={cn(
                "w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                termsChecked
                  ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_12px_rgba(255,46,158,0.35)]"
                  : "border-[rgba(255,46,158,0.35)] text-[rgba(255,180,220,0.55)]"
              )}
            >
              <ShieldAlert className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="wiz-caption text-[9px] mb-1" style={{ letterSpacing: "0.32em" }}>
                Término 02 · Reglamento
              </div>
              <div className="font-cinzel text-[15px] tracking-[0.06em] uppercase text-[#f5eaff]">
                Reglamento del torneo
              </div>
            </div>
          </div>

          {/* Body */}
          <p className="wiz-body text-[12px] mb-2">
            Confirmo que los 3 jugadores del equipo hemos leído el Handbook
            oficial (descargado en el paso anterior) y aceptamos cumplir con
            todas las reglas, mecánicas de sorteo, uso de comodines, código de
            conducta y protocolos de disputa.
          </p>
          <p className="wiz-body text-[12px] mb-3">
            Entendemos que el incumplimiento puede resultar en sanciones,
            descalificación del equipo o prohibición de participar en futuras
            ediciones.
          </p>

          {/* Handbook timestamp */}
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)]" strokeWidth={1.5} />
            <span className="wiz-meta text-[10px] normal-case">
              Handbook descargado: {data.handbookDownloadedAt?.toLocaleString("es-AR")}
            </span>
          </div>

          {/* Toggle */}
          <button
            onClick={handleTermsToggle}
            className="w-full flex items-center gap-3 pt-3 border-t border-[rgba(255,46,158,0.08)] text-left"
          >
            <span
              className={cn("wiz-check", termsChecked && "wiz-check-checked")}
              role="checkbox"
              aria-checked={termsChecked}
              aria-label="Aceptar reglamento"
            >
              {termsChecked && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
            </span>
            <span className={cn(
              "font-cinzel text-[11px] tracking-[0.22em] uppercase transition-colors",
              termsChecked ? "text-[#ff2e9e]" : "text-[rgba(255,180,220,0.55)]"
            )}>
              {termsChecked ? "Aceptado" : "Acepto el reglamento completo"}
            </span>
          </button>
        </article>
      </div>

      {/* ====== Status bar ====== */}
      <div className={cn(
        "wiz-card !rounded-[4px] px-5 py-3 flex items-center gap-3 max-w-3xl mx-auto w-full transition-all",
        canProceed && "wiz-card-active"
      )}>
        {canProceed ? (
          <>
            <Check className="w-4 h-4 text-[#ff2e9e] shrink-0" strokeWidth={2} />
            <p className="wiz-body text-[13px]">
              Ambos términos aceptados. Ya podés revisar y confirmar tu inscripción.
            </p>
          </>
        ) : (
          <>
            <Info className="w-4 h-4 text-[rgba(255,180,220,0.55)] shrink-0" strokeWidth={1.5} />
            <p className="wiz-meta text-[12px] normal-case">
              Aceptá los dos términos para continuar con la confirmación final.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
