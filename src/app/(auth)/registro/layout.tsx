"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WizardProvider, useWizard, WIZARD_STEPS } from "@/components/wizard/wizard-context";
import { toast } from "sonner";
import { signUpOrLogin, submitWizard } from "@/server/actions/wizard";

// ============================================================
// Wizard Shell — Layout centrado
// El wizard es una CARD CENTRADA dentro de la página (max-w-2xl),
// NO ocupa toda la pantalla. Como un modal elegante.
// ============================================================

function WizardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { step, totalSteps, prevStep, nextStep, data } = useWizard();
  const [submitting, setSubmitting] = useState(false);
  const [authDone, setAuthDone] = useState(false);

  const progress = (step / totalSteps) * 100;

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
    toast.success("¡Inscripción enviada!", {
      description: "El staff revisará tu solicitud.",
    });
    setTimeout(() => router.push("/mi-equipo"), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      {/* Card central — max-w-2xl */}
      <div
        className="w-full max-w-2xl"
        style={{
          background: "#0a0011",
          border: "1px solid rgba(255, 46, 158, 0.18)",
          borderRadius: "8px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255, 46, 158, 0.04)",
        }}
      >
        {/* HEADER */}
        <header style={{ borderBottom: "1px solid rgba(255, 46, 158, 0.1)" }}>
          <div className="px-8 pt-7 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="font-serif font-bold"
                  style={{
                    color: "#ff2e9e",
                    fontSize: "20px",
                    letterSpacing: "0.04em",
                  }}
                >
                  VÉRTIGO
                </div>
                <span style={{ color: "rgba(255,180,220,0.4)", fontSize: "11px", letterSpacing: "0.3em" }}>
                  INSCRIPCIÓN
                </span>
              </div>
              <button
                onClick={() => router.push("/")}
                style={{
                  color: "rgba(255,180,220,0.4)",
                  fontSize: "13px",
                }}
                className="hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>
            {/* Progress bar */}
            <div
              style={{
                height: "2px",
                background: "rgba(255, 46, 158, 0.1)",
                borderRadius: "1px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #ff2e9e, #ff6bb5)",
                  transition: "width 300ms cubic-bezier(0.22, 1, 0.36, 1)",
                  boxShadow: "0 0 8px rgba(255, 46, 158, 0.6)",
                }}
              />
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div
          className="px-8 py-8"
          style={{ minHeight: "420px", maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}
        >
          <style>{`
            /* Scrollbar oculto premium */
            .vertigo-scroll::-webkit-scrollbar { width: 0; height: 0; }
            .vertigo-scroll { scrollbar-width: none; -ms-overflow-style: none; }
          `}</style>
          <div className="vertigo-scroll" style={{ height: "100%" }}>
            {children}
          </div>
        </div>

        {/* FOOTER */}
        <footer
          style={{
            borderTop: "1px solid rgba(255, 46, 158, 0.1)",
            padding: "16px 32px",
          }}
          className="flex items-center justify-between"
        >
          <button
            onClick={prevStep}
            disabled={step === 1 || submitting}
            style={{
              color: "rgba(255,180,220,0.5)",
              fontSize: "13px",
              padding: "8px 16px",
            }}
            className="hover:text-white transition-colors disabled:opacity-30"
          >
            ← Atrás
          </button>

          {/* Stepper dots */}
          <div className="flex items-center gap-1.5">
            {WIZARD_STEPS.map((s) => (
              <div
                key={s.num}
                style={{
                  width: s.num === step ? "20px" : "6px",
                  height: "6px",
                  borderRadius: "3px",
                  background: s.num === step ? "#ff2e9e" : s.num < step ? "rgba(255, 46, 158, 0.4)" : "rgba(255, 46, 158, 0.12)",
                  transition: "all 300ms cubic-bezier(0.22, 1, 0.36, 1)",
                  boxShadow: s.num === step ? "0 0 6px rgba(255, 46, 158, 0.6)" : "none",
                }}
              />
            ))}
          </div>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || submitting}
              style={{
                background: canProceed() && !submitting ? "#ff2e9e" : "rgba(255, 46, 158, 0.2)",
                color: canProceed() && !submitting ? "#0a0011" : "rgba(255,180,220,0.4)",
                fontSize: "13px",
                fontWeight: 600,
                padding: "8px 20px",
                borderRadius: "4px",
                letterSpacing: "0.08em",
                transition: "all 200ms ease",
              }}
              className="disabled:cursor-not-allowed"
            >
              SIGUIENTE →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                background: "#ff2e9e",
                color: "#0a0011",
                fontSize: "13px",
                fontWeight: 700,
                padding: "8px 20px",
                borderRadius: "4px",
                letterSpacing: "0.08em",
                boxShadow: "0 0 16px rgba(255, 46, 158, 0.4)",
              }}
            >
              {submitting ? "ENVIANDO..." : "CONFIRMAR ✓"}
            </button>
          )}
        </footer>
      </div>
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
