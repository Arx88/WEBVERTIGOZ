"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WizardProvider, useWizard, WIZARD_STEPS } from "@/components/wizard/wizard-context";
import { toast } from "sonner";
import { signUpOrLogin, submitWizard } from "@/server/actions/wizard";

// ============================================================
// Wizard Shell — Layout 2 columnas dentro del card centrado
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
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#0a0011",
        backgroundImage: "radial-gradient(ellipse at 30% 20%, rgba(255, 46, 158, 0.08), transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(122, 90, 144, 0.05), transparent 50%)",
      }}
    >
      {/* Card centrado — 2 columnas */}
      <div
        style={{
          width: "100%",
          maxWidth: "920px",
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          background: "#0f0019",
          border: "1px solid rgba(255, 46, 158, 0.1)",
          borderRadius: "8px",
          boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
          overflow: "hidden",
          minHeight: "560px",
          maxHeight: "calc(100vh - 48px)",
        }}
      >
        {/* LEFT PANEL — brand + info del paso */}
        <aside
          style={{
            background: "linear-gradient(180deg, #14001f 0%, #0a0011 100%)",
            borderRight: "1px solid rgba(255, 46, 158, 0.08)",
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{
                fontFamily: "Cinzel, serif",
                fontSize: "26px",
                fontWeight: 700,
                color: "#ff2e9e",
                letterSpacing: "0.04em",
                textShadow: "0 0 12px rgba(255, 46, 158, 0.4)",
              }}>
                VÉRTIGO
              </span>
            </div>
            <div style={{
              fontSize: "10px",
              color: "rgba(255, 180, 220, 0.4)",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginTop: "4px",
            }}>
              Inscripción de equipo
            </div>
          </div>

          {/* Current step info */}
          <div>
            <div style={{
              fontSize: "11px",
              color: "rgba(255, 46, 158, 0.7)",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}>
              Paso {String(step).padStart(2, "0")} de {String(totalSteps).padStart(2, "0")}
            </div>
            <h2 style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#f5eaff",
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "-0.01em",
              marginBottom: "8px",
              lineHeight: 1.2,
            }}>
              {currentInfo.title}
            </h2>
            <p style={{
              fontSize: "13px",
              color: "rgba(255, 180, 220, 0.6)",
              lineHeight: 1.5,
            }}>
              {currentInfo.desc}
            </p>
          </div>

          {/* Stepper */}
          <div>
            <div style={{
              height: "2px",
              background: "rgba(255, 46, 158, 0.08)",
              borderRadius: "1px",
              overflow: "hidden",
              marginBottom: "16px",
            }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, #ff2e9e, #ff6bb5)",
                transition: "width 300ms cubic-bezier(0.22, 1, 0.36, 1)",
                boxShadow: "0 0 6px rgba(255, 46, 158, 0.5)",
              }} />
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              {WIZARD_STEPS.map((s) => (
                <div
                  key={s.num}
                  style={{
                    flex: 1,
                    height: "3px",
                    borderRadius: "2px",
                    background: s.num === step
                      ? "#ff2e9e"
                      : s.num < step
                      ? "rgba(255, 46, 158, 0.4)"
                      : "rgba(255, 46, 158, 0.08)",
                    transition: "all 300ms ease",
                  }}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL — contenido del paso */}
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#0a0011",
          }}
        >
          {/* Header bar */}
          <div style={{
            padding: "16px 32px",
            borderBottom: "1px solid rgba(255, 46, 158, 0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{
              fontSize: "11px",
              color: "rgba(255, 180, 220, 0.4)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}>
              Formulario de inscripción
            </span>
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
              Cancelar ✕
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              padding: "32px",
              overflowY: "auto",
            }}
            className="vertigo-scroll"
          >
            <style>{`
              .vertigo-scroll::-webkit-scrollbar { width: 0; height: 0; }
              .vertigo-scroll { scrollbar-width: none; }
            `}</style>
            {children}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 32px",
              borderTop: "1px solid rgba(255, 46, 158, 0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              onClick={prevStep}
              disabled={step === 1 || submitting}
              style={{
                color: "rgba(255, 180, 220, 0.5)",
                fontSize: "13px",
                padding: "8px 16px",
                background: "transparent",
                border: "none",
                cursor: step === 1 ? "default" : "pointer",
                opacity: step === 1 ? 0.3 : 1,
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
                  background: canProceed() && !submitting ? "#ff2e9e" : "rgba(255, 46, 158, 0.15)",
                  color: canProceed() && !submitting ? "#0a0011" : "rgba(255, 180, 220, 0.4)",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "10px 24px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: canProceed() && !submitting ? "pointer" : "default",
                  letterSpacing: "0.08em",
                  transition: "all 200ms ease",
                  boxShadow: canProceed() && !submitting ? "0 0 12px rgba(255, 46, 158, 0.3)" : "none",
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
                  padding: "10px 24px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                  boxShadow: "0 0 16px rgba(255, 46, 158, 0.4)",
                }}
              >
                {submitting ? "ENVIANDO..." : "CONFIRMAR ✓"}
              </button>
            )}
          </div>
        </main>
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
