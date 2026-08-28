"use client";

import { useState, useEffect, useRef, Fragment, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { WizardProvider, useWizard, WIZARD_STEPS, isValidEmblemId } from "@/components/wizard/wizard-context";
import { toast } from "sonner";
import { signUpOrLogin, submitWizard, getWizardResume, joinCupoWaitlist } from "@/server/actions/wizard";
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
  const { step, totalSteps, prevStep, nextStep, data, setStep, config, configFound, slots, updateData } = useWizard();
  const [submitting, setSubmitting] = useState(false);
  const [authDone, setAuthDone] = useState(false);
  const [maxReached, setMaxReached] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  // Waitlist de cupo: "notificarme si hay lugar" (solo visible con el cupo lleno)
  const [notifyState, setNotifyState] = useState<"idle" | "open" | "sending" | "done">("idle");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const notifySending = notifyState === "sending";

  const info = STEP_INFO[step - 1];
  const isLast = step === totalSteps;
  // Freno de entrada en lugar de los 9 pasos (antes el usuario recorría todo el
  // wizard y recién se frenaba al enviar): sin edición en "registration" o cupo completo.
  const closedNoEdition = configFound === false;
  const closedCupo = configFound === true && slots !== null && slots.remaining <= 0;
  const closed = closedNoEdition || closedCupo;
  const slotsTaken = slots?.taken ?? slots?.maxTeams ?? 32;
  const slotsMax = slots?.maxTeams ?? 32;
  const slotsPct = Math.min(100, Math.round((slotsTaken / slotsMax) * 100));

  const canProceed = (): boolean => {
    switch (step) {
      // Con sesión válida (resume), el paso 1 no vuelve a pedir credenciales
      case 1: return authDone || (data.email.length > 0 && data.password.length >= 6);
      case 2: return data.teamName.length >= 3 && isValidEmblemId(data.emblemId);
      case 3: {
        // Los 3 jugadores deben estar cargados, sin duplicados, Y el ELO total no debe superar el máximo
        const allLoaded = data.players.every((p) => p.aoe2ProfileId !== null);
        if (!allLoaded) return false;
        const ids = data.players.map((p) => p.aoe2ProfileId);
        if (new Set(ids).size !== 3) return false;
        const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
        return totalElo <= config.eloMax;
      }
      case 4: return data.players.some((p) => p.isCaptain);
      case 5: return data.baseCivIds.length === config.civsBase;
      case 6: return data.extraCivIds.length === config.civsExtra;
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

  async function handleNotify(e: FormEvent) {
    e.preventDefault();
    if (notifyState === "sending") return;
    setNotifyState("sending");
    setNotifyError(null);
    const r = await joinCupoWaitlist(notifyEmail);
    if (!r.ok) {
      setNotifyError(r.error);
      setNotifyState("open");
      return;
    }
    setNotifyState("done");
  }

  // ── Reanudación: si ya tenés cuenta con reino, precargar datos; si ya estás
  //    inscripto en la edición abierta, no repetir el wizard — directo a /mi-equipo.
  const resumeRan = useRef(false);
  async function applyResume(notify: boolean) {
    try {
      const r = await getWizardResume();
      if (!r.authenticated) return;
      if (r.hasOpenRegistration) {
        toast.info("Ya tenés un equipo inscripto en esta edición.", {
          description: "Te llevamos a Mi Reino para que lo gestiones.",
        });
        setTimeout(() => router.push("/mi-equipo"), 1500);
        return;
      }
      updateData({ email: r.email, existingAccount: true });
      setAuthDone(true); // sesión válida: no re-pedir password en el paso 1
      if (r.existingTeam) {
        updateData({
          teamName: r.existingTeam.name,
          teamTagline: r.existingTeam.tagline ?? "",
          emblemId: r.existingTeam.emblemId,
        });
        if (notify) {
          toast.success(`Cargamos los datos de tu reino "${r.existingTeam.name}".`, {
            description: "Podés ajustarlos antes de confirmar tu inscripción.",
          });
        }
      }
    } catch {
      // Si el resume falla, el wizard funciona como siempre desde cero.
    }
  }

  useEffect(() => {
    if (resumeRan.current) return;
    resumeRan.current = true;
    applyResume(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNext() {
    if (step === 1 && !authDone) {
      setSubmitting(true);
      const result = await signUpOrLogin(data);
      setSubmitting(false);
      if (!result.ok) { toast.error(result.error); return; }
      setAuthDone(true);
      // Login recién hecho: traer reino/inscripción existente (si hay)
      await applyResume(true);
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
        <div className={`modal-main ${closed ? "modal-closed" : ""}`}>

          {closed ? (
            /* FRENO: no hay pasos a la izquierda → el arte cubre toda esa zona
               con el logo encima, y a la derecha va el panel de estado. */
            <div className="art art-wide">
              <img src="/landing/wizard-art.webp" alt="Caballero contemplando el campo de batalla" />
              <div className="art-logo">
                <img src="/landing/logo.png" alt="VÉRTIGO Cup" />
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}

          {/* CONTENIDO */}
          <section className="content">
            <button className="close" id="closeBtn" aria-label="Cerrar" onClick={() => router.push("/")}>
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>

            <div className="panels" id="panels" key={closed ? "closed" : step}>
              {closed ? (
                <div className="panel active panel-slide-in">
                  <div className="wz-closed">
                    <div className="wz-seal">
                      {closedCupo ? (
                        <svg viewBox="0 0 24 24"><path d="M4 16L3 7l5 4 4-7 4 7 5-4-1 9z" /><path d="M5 19.5h14" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24"><path d="M8 11V8a4 4 0 0 1 8 0v3" /><rect x="6" y="11" width="12" height="9" rx="2" /><path d="M12 14.5v2" /></svg>
                      )}
                    </div>
                    <span className="p-kicker">VÉRTIGO Cup</span>
                    <h2 className="p-title">{closedCupo ? "Cupo completo" : "Inscripciones cerradas"}</h2>
                    <div className="p-divider"><span></span><i></i><span></span></div>
                    {closedCupo ? (
                      <p className="p-desc">
                        Los {slotsMax} lugares de esta edición ya están ocupados ({slotsTaken} equipos).
                        Si el staff libera lugares, las inscripciones se reabren — mientras tanto, seguí el torneo en vivo.
                      </p>
                    ) : (
                      <p className="p-desc">
                        No hay ninguna edición del torneo aceptando equipos en este momento.
                        Cuando el staff abra las inscripciones vas a poder anotar a tu reino desde acá.
                      </p>
                    )}
                    {closedCupo && (
                      <div className="wz-meter">
                        <div className="wz-meter-head">
                          <span>Lugares ocupados</span>
                          <strong>{slotsTaken} / {slotsMax}</strong>
                        </div>
                        <div className="wz-meter-bar"><i style={{ width: `${slotsPct}%` }} /></div>
                      </div>
                    )}
                    {closedCupo && (
                      <div className="wz-notify">
                        {notifyState === "done" ? (
                          <div className="wz-notify-done">
                            <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
                            <span>Listo. Te avisamos a <strong>{notifyEmail}</strong> si se libera un lugar.</span>
                          </div>
                        ) : notifyState === "open" ? (
                          <form className="wz-notify-form" onSubmit={handleNotify}>
                            <input
                              type="email"
                              required
                              autoFocus
                              placeholder="tu@email.com"
                              maxLength={254}
                              value={notifyEmail}
                              onChange={(e) => setNotifyEmail(e.target.value)}
                            />
                            <button className="btn primary" type="submit" disabled={notifySending}>
                              {notifySending ? "Anotando..." : "Avisarme"}
                            </button>
                            {notifyError && <p className="wz-notify-err">{notifyError}</p>}
                          </form>
                        ) : (
                          <button className="btn primary" onClick={() => setNotifyState("open")}>
                            <svg className="wz-bell" viewBox="0 0 24 24">
                              <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
                              <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
                            </svg>
                            <span>Notificarme si hay lugar</span>
                          </button>
                        )}
                      </div>
                    )}
                    <div className="wz-actions">
                      <a className="btn ghost" href="/bracket">Ver el bracket</a>
                      <a className="btn ghost" href="/tutorial">Cómo funciona</a>
                    </div>
                  </div>
                </div>
              ) : (
              <div className="panel active panel-slide-in" data-panel={step}>
                <span className="p-kicker">{info.kicker}</span>
                <h2 className="p-title">{info.title}</h2>
                <div className="p-divider"><span></span><i></i><span></span></div>
                <p className="p-desc">{info.desc}</p>
                {children}
              </div>
              )}
            </div>
          </section>
        </div>

        {/* FOOTER */}
        {!closed && (
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
              title={!canProceed() ? "Completá todos los campos requeridos para continuar" : undefined}
            >
              <span id="nextLabel">{isLast ? "Confirmar inscripción" : submitting ? "Procesando..." : "Siguiente"}</span>
              {!isLast && !submitting && canProceed() && (
                <svg className="i-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
              )}
              {isLast && !submitting && canProceed() && (
                <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
              )}
            </button>
          </div>
        </footer>
        )}

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
