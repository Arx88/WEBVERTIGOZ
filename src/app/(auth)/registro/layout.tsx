"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WizardProvider, useWizard, WIZARD_STEPS } from "@/components/wizard/wizard-context";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { signUpOrLogin, submitWizard } from "@/server/actions/wizard";

// ============================================================
// Wizard Shell — altura fija 100vh, sin scroll molesto
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

    toast.success("¡Inscripción enviada!", {
      description: "El staff revisará tu solicitud. Te avisaremos por email.",
    });

    setTimeout(() => router.push("/mi-equipo"), 1500);
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* HEADER FIJO */}
      <header className="border-b border-border-subtle shrink-0">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 border border-gold/60 rotate-45 flex items-center justify-center">
                <span className="-rotate-45 font-serif text-gold text-sm font-bold">V</span>
              </div>
              <span className="font-serif text-lg">VÉRTIGO · Inscripción</span>
            </div>
            <div className="label-premium text-text-secondary">
              Paso {step} de {totalSteps}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Progress value={progressValue} className="flex-1" />
            <span className="text-caption text-text-tertiary tabular-nums">
              {Math.round(progressValue)}%
            </span>
          </div>
        </div>
      </header>

      {/* TÍTULO FIJO DEL PASO */}
      <div className="border-b border-border-subtle shrink-0">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="label-premium text-gold/80 mb-2">PASO {step}</div>
          <h1 className="font-serif text-3xl md:text-4xl">{currentStepData.title}</h1>
        </div>
      </div>

      {/* CONTENIDO CENTRAL */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </div>

      {/* FOOTER FIJO */}
      <footer className="border-t border-border-subtle shrink-0 bg-bg-elevated">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="default" onClick={prevStep} disabled={step === 1 || submitting}>
            <ChevronLeft className="w-4 h-4" />
            Atrás
          </Button>

          <div className="hidden md:flex items-center gap-2">
            {WIZARD_STEPS.map((s) => (
              <button
                key={s.num}
                onClick={() => goToStep(s.num)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  s.num === step ? "w-6 bg-gold" : s.num < step ? "bg-gold/60" : "bg-border-strong"
                )}
                aria-label={`Paso ${s.num}: ${s.short}`}
              />
            ))}
          </div>

          {!isLastStep ? (
            <Button
              variant="default"
              size="default"
              onClick={handleNext}
              disabled={!canProceed() || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Siguiente
            </Button>
          ) : (
            <Button
              variant="premium"
              size="default"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Confirmar inscripción
            </Button>
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
