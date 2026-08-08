"use client";

import { useState, Fragment, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WizardProvider, useWizard, WIZARD_STEPS } from "@/components/wizard/wizard-context";
import { toast } from "sonner";
import { signUpOrLogin, submitWizard } from "@/server/actions/wizard";
import "@/styles/wizard-referencia.css";

const STEP_INFO = [
  { kicker: "Paso 1 de 9", title: "Tu cuenta", desc: "Creá la cuenta de equipo para gestionar tu inscripción al torneo." },
  { kicker: "Paso 2 de 9", title: "Información del equipo", desc: "Nombre, frase y escudo que representará a tu equipo." },
  { kicker: "Paso 3 de 9", title: "Jugadores", desc: "Buscá en AoE2 Companion y cargá los 3 jugadores de tu equipo." },
  { kicker: "Paso 4 de 9", title: "Elegir capitán", desc: "El capitán será el contacto oficial con el staff del torneo." },
  { kicker: "Paso 5 de 9", title: "Civilizaciones base", desc: "Elegí 9 civilizaciones para el sorteo. Tu rival no verá tu pool." },
  { kicker: "Paso 6 de 9", title: "Civilizaciones extra", desc: "3 civs adicionales que se suman si llegás a la final." },
  { kicker: "Paso 7 de 9", title: "Handbook", desc: "Descargá el reglamento oficial antes de aceptar los términos." },
  { kicker: "Paso 8 de 9", title: "Reglas y normativas", desc: "Leé y aceptá las condiciones del torneo." },
  { kicker: "Paso 9 de 9", title: "Confirmación", desc: "Revisá que todo esté en orden antes de sellar tu inscripción." },
];

function WizardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { step, totalSteps, prevStep, nextStep, data, setStep } = useWizard();
  const [submitting, setSubmitting] = useState(false);
  const [authDone, setAuthDone] = useState(false);
  const [maxReached, setMaxReached] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const info = STEP_INFO[step - 1];
  const isLast = step === totalSteps;

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return data.email.length > 0 && data.password.length >= 6;
      case 2: return data.teamName.length >= 3 && data.emblemId !== null;
      case 3: {
        // Los 3 jugadores deben estar cargados Y el ELO total no debe superar el máximo
        const allLoaded = data.players.every((p) => p.aoe2ProfileId !== null);
        if (!allLoaded) return false;
        const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
        return totalElo <= 3520;
      }
      case 4: return data.players.some((p) => p.isCaptain);
      case 5: return data.baseCivIds.length === 9;
      case 6: return data.extraCivIds.length === 3;
      case 7: return data.handbookDownloadedAt !== null;
      case 8: return data.restreamAccepted && data.termsAcceptedAt !== null;
      case 9: return true;
      default: return false;
    }
  };

  function goTo(n: number) {
    if (n < 1 || n > totalSteps || n > maxReached) return;
    setStep(n);
  }

  async function handleNext() {
    if (step === 1 && !authDone) {
      setSubmitting(true);
      const result = await signUpOrLogin(data);
      setSubmitting(false);
      if (!result.ok) { toast.error(result.error); return; }
      setAuthDone(true);
    }
    if (step < totalSteps) {
      nextStep();
      setMaxReached((m) => Math.max(m, step + 1));
    } else {
      setSubmitting(true);
      const result = await submitWizard(data);
      setSubmitting(false);
      if (!result.ok) { toast.error(result.error); return; }
      setShowSuccess(true);
      setTimeout(() => router.push("/mi-equipo"), 2500);
    }
  }

  return (
    <Fragment>
      {/* Video de fondo */}
      <video className="wizard-bg-video" autoPlay muted loop playsInline>
        <source src="/landing/wizard-bg.mp4" type="video/mp4" />
      </video>
      {/* Overlay oscuro para legibilidad */}
      <div className="wizard-bg-overlay" />

      <div className="wizard-page">
        <div className="modal" id="modal">
        <div className="modal-main">

          {/* SIDEBAR */}
          <aside className="sidebar">
            <div className="logo" style={{ textAlign: "center", marginBottom: "24px" }}>
              <img src="/landing/logo.png" alt="VÉRTIGO Cup" style={{ width: "120px", margin: "0 auto", display: "block" }} />
            </div>

            <ol className="steps" id="steps">
              {WIZARD_STEPS.map((s) => (
                <li
                  key={s.num}
                  className={`step ${s.num === step ? "is-active" : ""} ${s.num < step ? "done" : ""}`}
                  data-step={s.num}
                  onClick={() => goTo(s.num)}
                  style={{ position: "relative", display: "flex", alignItems: "center", gap: "16px", padding: "12px 4px", cursor: s.num <= maxReached ? "pointer" : "default" }}
                >
                  <span className="dot">
                    <span className="num">{s.roman}</span>
                    <svg className="check" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
                  </span>
                  <span className="label">{s.label}</span>
                </li>
              ))}
            </ol>
          </aside>

          {/* ARTE */}
          <div className="art">
            <img src="/landing/wizard-art.webp" alt="Caballero contemplando el campo de batalla" />
          </div>

          {/* CONTENIDO */}
          <section className="content">
            <button className="close" id="closeBtn" aria-label="Cerrar" onClick={() => router.push("/")}>
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>

            <div className="panels" id="panels">
              {/* Panel header (dinámico según el paso) */}
              <div className="panel active" data-panel={step}>
                <span className="p-kicker">{info.kicker}</span>
                <h2 className="p-title">{info.title}</h2>
                <div className="p-divider"><span></span><i></i><span></span></div>
                <p className="p-desc">{info.desc}</p>
                {children}
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="modal-footer">
          <button className="btn ghost" onClick={() => router.push("/")}>Cancelar</button>
          <div className="footer-right">
            <button
              className="btn ghost"
              id="backBtn"
              onClick={prevStep}
              style={{ visibility: step === 1 ? "hidden" : "visible" }}
            >
              Atrás
            </button>
            <button
              className="btn primary"
              id="nextBtn"
              onClick={handleNext}
              disabled={!canProceed() || submitting}
            >
              <span id="nextLabel">{isLast ? "Confirmar inscripción" : submitting ? "Procesando..." : "Siguiente"}</span>
              {!isLast && !submitting && (
                <svg className="i-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
              )}
              {isLast && !submitting && (
                <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
              )}
            </button>
          </div>
        </footer>

        {/* ÉXITO */}
        {showSuccess && (
          <div className="success show" id="success">
            <div>
              <div className="seal">
                <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
              </div>
              <h3>¡Inscripción completada!</h3>
              <p>Tu equipo ya forma parte de la Vertigo Cup. Que la fortuna acompañe a tus civs.</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </Fragment>
  );
}

export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <WizardProvider>
      <WizardShell>{children}</WizardShell>
    </WizardProvider>
  );
}
