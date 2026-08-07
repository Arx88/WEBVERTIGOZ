"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WizardProvider, useWizard, WIZARD_STEPS } from "@/components/wizard/wizard-context";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { signUpOrLogin, submitWizard } from "@/server/actions/wizard";

// ============================================================
// Wizard Shell — altura fija 100vh, sin scroll vertical molesto
// Paleta magenta VÉRTIGO (replica estética del landing)
// ============================================================

function WizardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { step, totalSteps, prevStep, nextStep, goToStep, data } = useWizard();
  const [submitting, setSubmitting] = useState(false);
  const [authDone, setAuthDone] = useState(false);

  const currentStepData = WIZARD_STEPS[step - 1];
  const progressValue = (step / totalSteps) * 100;

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return data.email.length > 0 && data.password.length >= 6;
      case 2: return data.teamName.length >= 3 && data.emblemId !== null;
      case 3: return data.players.every((p) => p.aoe2ProfileId !== null);
      case 4: return data.players.some((p) => p.isCaptain);
      case 5: return data.baseCivIds.length === 9;
      case 6: return data.extraCivIds.length === 3;
      case 7: return data.handbookDownloadedAt !== null;
      case 8: return data.restreamAccepted && data.termsAcceptedAt !== null;
      case 9: return true;
      default: return false;
    }
  };

  const isLastStep = step === totalSteps;

  async function handleNext() {
    // En el paso 1 → hacer auth al avanzar
    if (step === 1 && !authDone) {
      setSubmitting(true);
      const result = await signUpOrLogin(data);
      setSubmitting(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAuthDone(true);
      toast.success(data.existingAccount ? "Sesión iniciada" : "Cuenta creada");
    }
    nextStep();
  }

  async function handleSubmit() {
    setSubmitting(true);
    const result = await submitWizard(data);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Inscripción enviada", {
      description: "El staff revisará tu solicitud. Te avisaremos por email.",
    });

    setTimeout(() => router.push("/mi-equipo"), 1500);
  }

  return (
    <div className="wiz-bg h-screen flex flex-col overflow-hidden text-[#f5eaff]">
      {/* HEADER FIJO — logo + step X/9 + progress magenta */}
      <header className="shrink-0 border-b border-[rgba(255,46,158,0.15)] bg-[rgba(10,0,17,0.55)] backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rotate-45 border border-[rgba(255,46,158,0.7)] flex items-center justify-center shadow-[0_0_14px_rgba(255,46,158,0.35)]">
              <span className="-rotate-45 font-cinzel text-[#ff2e9e] text-sm font-bold">V</span>
            </div>
            <span className="font-cinzel text-[13px] tracking-[0.32em] uppercase text-[#f5eaff] hidden sm:inline">
              VÉRTIGO · Inscripción
            </span>
          </div>

          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="wiz-progress-track flex-1">
              <div
                className="wiz-progress-fill"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <span className="wiz-caption tabular-nums text-[10px] whitespace-nowrap">
              {String(step).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
            </span>
          </div>
        </div>
      </header>

      {/* TÍTULO FIJO DEL PASO */}
      <div className="shrink-0 text-center pt-5 pb-3 px-6">
        <div className="badge-thin mx-auto inline-flex">
          Paso {String(step).padStart(2, "0")} · {currentStepData.short}
        </div>
        <h1
          key={step}
          className="wiz-step-in font-cinzel text-[24px] md:text-[32px] leading-tight uppercase tracking-[0.08em] text-neon mt-3"
        >
          {currentStepData.title}
        </h1>
      </div>

      {/* CONTENIDO CENTRAL — puede tener scroll INTERNO oculto */}
      <div className="flex-1 min-h-0 overflow-y-auto wiz-scroll-hide">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-center min-h-full">
          <div key={step} className="wiz-step-in w-full">{children}</div>
        </div>
      </div>

      {/* FOOTER FIJO — Atrás | dots | Siguiente */}
      <footer className="shrink-0 border-t border-[rgba(255,46,158,0.15)] bg-[rgba(10,0,17,0.55)] backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-3.5 flex items-center justify-between gap-4">
          <button
            onClick={prevStep}
            disabled={step === 1 || submitting}
            className="wiz-btn-ghost"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            Atrás
          </button>

          <div className="hidden sm:flex items-center gap-1.5">
            {WIZARD_STEPS.map((s) => (
              <button
                key={s.num}
                onClick={() => goToStep(s.num)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  s.num === step
                    ? "w-6 bg-[#ff2e9e] shadow-[0_0_10px_rgba(255,46,158,0.7)]"
                    : s.num < step
                    ? "w-1.5 bg-[rgba(255,46,158,0.5)]"
                    : "w-1.5 bg-[rgba(255,46,158,0.18)]"
                )}
                aria-label={`Paso ${s.num}: ${s.short}`}
              />
            ))}
          </div>

          {!isLastStep ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || submitting}
              className="wiz-btn-primary"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              )}
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="wiz-btn-primary"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Check className="w-4 h-4" strokeWidth={1.5} />
              )}
              Confirmar inscripción
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <WizardProvider>
      <WizardShell>{children}</WizardShell>
    </WizardProvider>
  );
}
