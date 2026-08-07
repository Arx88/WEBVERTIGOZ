"use client";

import { useState, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WizardProvider, useWizard, WIZARD_STEPS } from "@/components/wizard/wizard-context";
import { ChevronLeft, ChevronRight, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { signUpOrLogin, submitWizard } from "@/server/actions/wizard";

// ============================================================
// Wizard Shell — VÉRTIGO brand redesign
// 4-row grid: HEADER (h-16) / TITLE BAR (h-24) / CONTENT (flex-1) / FOOTER (h-16)
// h-screen overflow-hidden — sin scroll vertical en el shell
// Paleta magenta del landing · Cinzel titles + Inter body
// ============================================================

function WizardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { step, totalSteps, prevStep, nextStep, goToStep, data } = useWizard();
  const [submitting, setSubmitting] = useState(false);
  const [authDone, setAuthDone] = useState(false);

  // Track slide direction for transition (forward = slide from right)
  const prevStepRef = useRef(step);
  const isForward = step >= prevStepRef.current;
  if (step !== prevStepRef.current) prevStepRef.current = step;

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
    <div className="wiz-bg relative h-screen flex flex-col overflow-hidden text-[#f5eaff] font-inter">
      {/* ============ HEADER (h-16) ============ */}
      <header className="relative z-10 shrink-0 h-16 border-b border-[rgba(255,46,158,0.15)] bg-[rgba(10,0,17,0.55)] backdrop-blur-md">
        <div className="h-full mx-auto max-w-6xl px-6 flex items-center justify-between gap-6">
          {/* Logo + brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-8 h-8 rotate-45 border border-[rgba(255,46,158,0.7)] flex items-center justify-center shadow-[0_0_14px_rgba(255,46,158,0.35)] shrink-0">
              <span className="-rotate-45 font-cinzel text-[#ff2e9e] text-sm font-bold">V</span>
            </div>
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="font-cinzel text-[12px] tracking-[0.32em] uppercase text-[#f5eaff] truncate">
                Vértigo
              </span>
              <span className="font-inter text-[9px] tracking-[0.22em] uppercase text-[rgba(255,180,220,0.55)] truncate">
                Inscripción del equipo
              </span>
            </div>
          </div>

          {/* Progress + counter — centered */}
          <div className="flex-1 flex items-center gap-4 max-w-md">
            <div className="wiz-progress-track flex-1">
              <div
                className="wiz-progress-fill"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <span className="font-cinzel text-[11px] tabular-nums whitespace-nowrap tracking-[0.18em] text-[#ffb4dc]">
              {String(step).padStart(2, "0")}
              <span className="text-[rgba(255,180,220,0.4)] mx-1">/</span>
              {String(totalSteps).padStart(2, "0")}
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={() => router.push("/")}
            aria-label="Salir del wizard"
            className="group flex items-center justify-center w-9 h-9 border border-[rgba(255,180,220,0.18)] hover:border-[rgba(255,46,158,0.55)] hover:bg-[rgba(255,46,158,0.04)] transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)] group-hover:text-[#ff2e9e] transition-colors" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* ============ TITLE BAR (h-24) ============ */}
      <div className="relative z-10 shrink-0 h-24 px-6 flex flex-col items-center justify-center gap-2 border-b border-[rgba(255,46,158,0.08)]">
        <div className="flex items-center gap-3">
          <span className="h-px w-6 bg-[rgba(255,46,158,0.4)]" />
          <span className="badge-thin !py-1.5 !px-3 !text-[10px] !tracking-[0.32em]">
            Paso {String(step).padStart(2, "0")} · {currentStepData.short}
          </span>
          <span className="h-px w-6 bg-[rgba(255,46,158,0.4)]" />
        </div>
        <h1
          key={`title-${step}`}
          className={cn(
            "font-cinzel text-[22px] md:text-[28px] leading-tight uppercase tracking-[0.08em] text-neon",
            isForward ? "wiz-step-in" : "wiz-step-back"
          )}
        >
          {currentStepData.title}
        </h1>
      </div>

      {/* ============ CONTENT (flex-1) ============ */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto wiz-scroll-hide">
        <div className="h-full w-full mx-auto max-w-6xl px-6 py-6 flex items-center justify-center">
          <div
            key={`step-${step}`}
            className={cn(
              "w-full max-w-6xl",
              isForward ? "wiz-step-in" : "wiz-step-back"
            )}
          >
            {children}
          </div>
        </div>
      </div>

      {/* ============ FOOTER (h-16) ============ */}
      <footer className="relative z-10 shrink-0 h-16 border-t border-[rgba(255,46,158,0.15)] bg-[rgba(10,0,17,0.55)] backdrop-blur-md">
        <div className="h-full mx-auto max-w-6xl px-6 flex items-center justify-between gap-4">
          <button
            onClick={prevStep}
            disabled={step === 1 || submitting}
            className="wiz-btn-ghost"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            Atrás
          </button>

          <div className="hidden md:flex items-center gap-1.5">
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
