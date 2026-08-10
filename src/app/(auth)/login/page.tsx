"use client";

import { useState, Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, Eye, EyeOff } from "lucide-react";
import "@/styles/wizard-referencia.css";

// Countdown hasta la fecha del torneo (configurable)
const TOURNAMENT_DATE = new Date("2026-09-15T20:00:00-03:00");

function Countdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    function update() {
      const now = new Date();
      const diff = TOURNAMENT_DATE.getTime() - now.getTime();
      if (diff <= 0) return;
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
        secs: Math.floor((diff / 1000) % 60),
      });
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
      {[
        { val: String(timeLeft.days).padStart(2, "0"), label: "DÍAS" },
        { val: String(timeLeft.hours).padStart(2, "0"), label: "HRS" },
        { val: String(timeLeft.mins).padStart(2, "0"), label: "MIN" },
        { val: String(timeLeft.secs).padStart(2, "0"), label: "SEG" },
      ].map((t) => (
        <div key={t.label} style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "Cinzel, serif",
            fontSize: "clamp(24px, 2.2vw, 32px)",
            fontWeight: 700,
            color: "#c4b5fd",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "1px",
          }}>
            {t.val}
          </div>
          <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "2px", color: "#6b6378", textTransform: "uppercase", marginTop: "4px" }}>
            {t.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("¡Bienvenido!", { description: `Sesión iniciada como ${data.user?.email}` });
      router.push("/mi-equipo");
      router.refresh();
    } catch (err) {
      toast.error("Error al iniciar sesión", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Fragment>
      {/* Video de fondo */}
      <video className="wizard-bg-video" autoPlay muted loop playsInline>
        <source src="/landing/wizard-bg.mp4" type="video/mp4" />
      </video>
      <div className="wizard-bg-overlay" />

      <div className="wizard-page">
        {/* ===== PANEL IZQUIERDO — Editorial ===== */}
        <div className="login-editorial">
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <img
              src="/landing/logo.png"
              alt="VÉRTIGO Cup"
              style={{ width: "140px", margin: "0 auto", display: "block", opacity: 0.95 }}
            />
          </div>

          {/* Divisor */}
          <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)", margin: "0 auto 36px" }} />

          {/* Cita del torneo */}
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <p style={{
              fontFamily: "Cinzel, serif",
              fontSize: "clamp(15px, 1.4vw, 18px)",
              fontStyle: "italic",
              lineHeight: 1.8,
              color: "#b5adc4",
              maxWidth: "360px",
              margin: "0 auto",
            }}>
              &ldquo;Cada partida es un misterio hasta el último momento. Solo los preparados sobreviven al vértigo.&rdquo;
            </p>
            <p style={{
              fontFamily: "Cinzel, serif",
              fontSize: "11px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#6b6378",
              marginTop: "20px",
            }}>
              — VÉRTIGO Cup
            </p>
          </div>

          {/* Countdown */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#6b6378",
              marginBottom: "16px",
            }}>
              La ruleta se detiene en
            </div>
            <Countdown />
          </div>

          {/* Línea de stats */}
          <div style={{
            marginTop: "40px",
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            fontSize: "11px",
            color: "#6b6378",
          }}>
            <span>32 equipos</span>
            <span>·</span>
            <span>3 jugadores</span>
            <span>·</span>
            <span>5 rondas</span>
          </div>
        </div>

        {/* ===== MODAL DE LOGIN ===== */}
        <div className="login-modal-wrap">
          <div className="modal" style={{ width: "min(480px, 94vw)", height: "auto", minHeight: "min(620px, 90vh)" }}>
            <div className="modal-main" style={{ display: "flex", flexDirection: "column", gridTemplateColumns: "unset" }}>

              {/* CONTENIDO */}
              <section className="content" style={{ padding: "48px 48px 36px", display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, position: "relative" }}>
                {/* Botón cerrar */}
                <button
                  className="close"
                  aria-label="Cerrar"
                  onClick={() => router.push("/")}
                  style={{
                    position: "absolute", top: "22px", right: "22px",
                    width: "40px", height: "40px", borderRadius: "10px",
                    border: "1px solid var(--input-border)", background: "transparent",
                    cursor: "pointer", display: "grid", placeItems: "center",
                    transition: "all .35s var(--ease)",
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", stroke: "#b7b0c2", strokeWidth: 2, strokeLinecap: "round", fill: "none", transition: "all .35s var(--ease)" }}>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>

                {/* Logo pequeño */}
                <div style={{ textAlign: "center", marginBottom: "28px" }}>
                  <img
                    src="/landing/logo.png"
                    alt="VÉRTIGO Cup"
                    style={{ width: "80px", margin: "0 auto", display: "block", opacity: 0.8 }}
                  />
                </div>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                  <span className="p-kicker" style={{ display: "block", textAlign: "center", marginBottom: "10px" }}>
                    INGRESAR
                  </span>
                  <h2 className="p-title" style={{ fontSize: "26px", textAlign: "center" }}>
                    Iniciar sesión
                  </h2>
                  <div className="p-divider" style={{ margin: "16px auto 18px", maxWidth: "300px" }}>
                    <span></span><i></i><span></span>
                  </div>
                  <p className="p-desc" style={{ textAlign: "center", fontSize: "13px", maxWidth: "340px", margin: "0 auto" }}>
                    Accedé a tu cuenta para gestionar tu equipo, ver tus partidos y administrar el torneo.
                  </p>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  <div className="field" style={{ marginBottom: "20px" }}>
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: "28px" }}>
                    <label htmlFor="password">Contraseña</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        disabled={loading}
                        style={{ paddingRight: "48px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                          background: "transparent", border: "none", cursor: "pointer",
                          color: "#6b6378", padding: "4px",
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn primary"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      padding: "16px 34px",
                      opacity: loading || !email || !password ? 0.5 : 1,
                      cursor: loading || !email || !password ? "not-allowed" : "pointer",
                    }}
                    disabled={loading || !email || !password}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                        INGRESANDO...
                      </>
                    ) : (
                      "INGRESAR"
                    )}
                  </button>
                </form>

                {/* Link a registro */}
                <div style={{
                  marginTop: "28px", paddingTop: "20px",
                  borderTop: "1px solid var(--line-soft)", textAlign: "center",
                }}>
                  <p style={{ fontSize: "13px", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>
                    ¿No tenés equipo inscripto?{" "}
                    <Link
                      href="/registro"
                      style={{ color: "var(--purple-soft)", textDecoration: "none", fontWeight: 600 }}
                      className="link-hover"
                    >
                      Inscríbete ahora →
                    </Link>
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .link-hover { transition: color .3s; }
        .link-hover:hover { color: var(--purple-pale) !important; }

        /* ===== LOGIN PAGE — Layout editorial ===== */
        .wizard-page {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
        }

        /* Panel editorial izquierdo */
        .login-editorial {
          display: none;
          flex-direction: column;
          align-items: center;
          justifyContent: center;
          width: 380px;
          flex: none;
          padding: 48px 40px;
          background: rgba(10, 7, 17, 0.6);
          border-right: 1px solid var(--line-soft);
          height: 100vh;
          overflow: hidden;
          position: relative;
          z-index: 2;
        }

        /* Borde derecho con glow */
        .login-editorial::after {
          content: '';
          position: absolute;
          right: 0;
          top: 15%;
          bottom: 15%;
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(124,58,237,0.35), transparent);
        }

        /* Modal de login a la derecha */
        .login-modal-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        /* Responsive: en mobile ocultar el panel editorial */
        @media (min-width: 900px) {
          .login-editorial {
            display: flex;
          }
        }

        /* El modal del login sí necesita su animación */
        .wizard-page .modal {
          animation: modalIn 0.7s cubic-bezier(.22,1,.36,1) both;
        }

        /* Dark body */
        body:has(.wizard-page) {
          background: #070310 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          width: 100vw !important;
          height: 100vh !important;
        }
      `}</style>
    </Fragment>
  );
}
