"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WizardProvider, useWizard, WIZARD_STEPS } from "@/components/wizard/wizard-context";
import { toast } from "sonner";
import { signUpOrLogin, submitWizard } from "@/server/actions/wizard";

// ============================================================
// Wizard Shell — Layout full-screen sin card flotante
// Estilo Linear/Stripe onboarding:
// - Header sticky arriba con logo + progress + salir
// - Content area centrado con max-w-2xl
// - Footer sticky abajo con navegación
// ============================================================

const STEP_INFO = [
  { num: 1, title: "Tu cuenta", desc: "Empezá creando la cuenta de tu equipo" },
  { num: 2, title: "Datos del equipo", desc: "Nombre, frase y escudo" },
  { num: 3, title: "Jugadores", desc: "Cargá los 3 jugadores de tu equipo" },
  { num: 4, title: "Capitán", desc: "Elegí quién será el capitán" },
  { num: 5, title: "9 civs base", desc: "Las civilizaciones para el torneo" },
  { num: 6, title: "3 civs extra", desc: "Civs adicionales para la final" },
  { num: 7, title: "Handbook", desc: "Descargá el reglamento oficial" },
  { num: 8, title: "Términos", desc: "Aceptá los términos del torneo" },
  { num: 9, title: "Confirmación", desc: "Revisá y enviá la inscripción" },
];

function WizardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { step, totalSteps, prevStep, nextStep, data } = useWizard();
  const [submitting, setSubmitting] = useState(false);
  const [authDone, setAuthDone] = useState(false);

  const progress = (step / totalSteps) * 100;
  const currentInfo = STEP_INFO[step - 1];

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0011",
        backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255, 46, 158, 0.08), transparent)",
      }}
    >
      {/* HEADER sticky */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(10, 0, 17, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 46, 158, 0.08)",
        }}
      >
        <div style={{
          maxWidth: "768px",
          margin: "0 auto",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          {/* Left: logo */}
          <button
            onClick={() => router.push("/")}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{
              fontFamily: "Cinzel, serif",
              fontSize: "22px",
              fontWeight: 700,
              color: "#ff2e9e",
              letterSpacing: "0.04em",
              textShadow: "0 0 10px rgba(255, 46, 158, 0.4)",
            }}>
              VÉRTIGO
            </span>
            <span style={{
              fontSize: "10px",
              color: "rgba(255, 180, 220, 0.4)",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}>
              Inscripción
            </span>
          </button>

          {/* Center: progress dots */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {WIZARD_STEPS.map((s) => (
              <button
                key={s.num}
                onClick={() => { /* solo visual, no permite saltar */ }}
                style={{
                  width: s.num === step ? "24px" : "6px",
                  height: "6px",
                  borderRadius: "3px",
                  background: s.num === step
                    ? "#ff2e9e"
                    : s.num < step
                    ? "rgba(255, 46, 158, 0.4)"
                    : "rgba(255, 46, 158, 0.1)",
                  transition: "all 300ms cubic-bezier(0.22, 1, 0.36, 1)",
                  border: "none",
                  cursor: "default",
                  padding: 0,
                }}
              />
            ))}
          </div>

          {/* Right: salir */}
          <button
            onClick={() => router.push("/")}
            style={{
              color: "rgba(255, 180, 220, 0.4)",
              fontSize: "12px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            className="hover:text-white transition-colors"
          >
            Salir ✕
          </button>
        </div>
        {/* Progress bar */}
        <div style={{
          height: "1px",
          background: "rgba(255, 46, 158, 0.06)",
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${progress}%`,
            background: "#ff2e9e",
            transition: "width 400ms cubic-bezier(0.22, 1, 0.36, 1)",
            boxShadow: "0 0 8px rgba(255, 46, 158, 0.6)",
          }} />
        </div>
      </header>

      {/* CONTENT — centrado con max-w-2xl */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div style={{ maxWidth: "560px", margin: "0 auto", width: "100%" }}>
          {/* Step header */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{
              fontSize: "11px",
              color: "rgba(255, 46, 158, 0.7)",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginBottom: "8px",
              fontWeight: 500,
            }}>
              Paso {step} de {totalSteps}
            </div>
            <h1 style={{
              fontSize: "32px",
              fontWeight: 600,
              color: "#f5eaff",
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "-0.02em",
              marginBottom: "6px",
              lineHeight: 1.2,
            }}>
              {currentInfo.title}
            </h1>
            <p style={{
              fontSize: "14px",
              color: "rgba(255, 180, 220, 0.6)",
              lineHeight: 1.5,
            }}>
              {currentInfo.desc}
            </p>
          </div>

          {/* Step content */}
          <div>
            {children}
          </div>
        </div>
      </main>

      {/* FOOTER sticky */}
      <footer
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          background: "rgba(10, 0, 17, 0.85)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255, 46, 158, 0.08)",
        }}
      >
        <div style={{
          maxWidth: "768px",
          margin: "0 auto",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <button
            onClick={prevStep}
            disabled={step === 1 || submitting}
            style={{
              color: "rgba(255, 180, 220, 0.5)",
              fontSize: "13px",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              cursor: step === 1 ? "default" : "pointer",
              opacity: step === 1 ? 0.3 : 1,
              transition: "color 200ms ease",
            }}
            className="hover:text-white transition-colors"
          >
            ← Atrás
          </button>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || submitting}
              style={{
                background: canProceed() && !submitting ? "#ff2e9e" : "rgba(255, 46, 158, 0.12)",
                color: canProceed() && !submitting ? "#0a0011" : "rgba(255, 180, 220, 0.4)",
                fontSize: "13px",
                fontWeight: 600,
                padding: "10px 28px",
                borderRadius: "4px",
                border: "none",
                cursor: canProceed() && !submitting ? "pointer" : "default",
                letterSpacing: "0.05em",
                transition: "all 200ms ease",
                boxShadow: canProceed() && !submitting ? "0 0 14px rgba(255, 46, 158, 0.3)" : "none",
              }}
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
                padding: "10px 28px",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.05em",
                boxShadow: "0 0 18px rgba(255, 46, 158, 0.4)",
              }}
            >
              {submitting ? "ENVIANDO..." : "CONFIRMAR INSCRIPCIÓN ✓"}
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
