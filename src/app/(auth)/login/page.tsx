"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import "@/styles/wizard-referencia.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      {/* Video de fondo — mismo que el wizard */}
      <video className="wizard-bg-video" autoPlay muted loop playsInline>
        <source src="/landing/wizard-bg.mp4" type="video/mp4" />
      </video>
      {/* Overlay oscuro para legibilidad */}
      <div className="wizard-bg-overlay" />

      {/* Página con modal centrado — misma estética que el wizard */}
      <div className="wizard-page">
        <div className="modal" style={{
          width: "min(480px, 94vw)",
          height: "auto",
          minHeight: "min(580px, 90vh)",
          display: "flex",
          flexDirection: "column",
        }}>
          <div className="modal-main" style={{
            display: "flex",
            flexDirection: "column",
            gridTemplateColumns: "unset",
          }}>

            {/* CONTENIDO */}
            <section className="content" style={{
              padding: "48px 48px 36px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
            }}>
              {/* Botón cerrar */}
              <button
                className="close"
                aria-label="Cerrar"
                onClick={() => router.push("/")}
                style={{
                  position: "absolute",
                  top: "22px",
                  right: "22px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  border: "1px solid var(--input-border)",
                  background: "transparent",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  transition: "all .35s var(--ease)",
                }}
              >
                <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", stroke: "#b7b0c2", strokeWidth: 2, strokeLinecap: "round", fill: "none", transition: "all .35s var(--ease)" }}>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              {/* Logo */}
              <div style={{ textAlign: "center", marginBottom: "32px" }}>
                <img
                  src="/landing/logo.png"
                  alt="VÉRTIGO Cup"
                  style={{ width: "100px", margin: "0 auto", display: "block", opacity: 0.9 }}
                />
              </div>

              {/* Header del panel */}
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <span className="p-kicker" style={{ display: "block", textAlign: "center", marginBottom: "10px" }}>
                  INGRESAR
                </span>
                <h2 className="p-title" style={{ fontSize: "26px", textAlign: "center" }}>
                  Iniciar sesión
                </h2>
                <div className="p-divider" style={{ margin: "16px auto 18px", maxWidth: "300px" }}>
                  <span></span>
                  <i></i>
                  <span></span>
                </div>
                <p className="p-desc" style={{ textAlign: "center", fontSize: "13px", maxWidth: "360px", margin: "0 auto" }}>
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
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />
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
                marginTop: "28px",
                paddingTop: "20px",
                borderTop: "1px solid var(--line-soft)",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "13px", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>
                  ¿No tenés equipo inscripto?{" "}
                  <Link
                    href="/registro"
                    style={{
                      color: "var(--purple-soft)",
                      textDecoration: "none",
                      fontWeight: 600,
                      transition: "color .3s",
                    }}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .link-hover:hover { color: var(--purple-pale) !important; }

        /* Estilos adicionales para el modal del login */
        .wizard-page .modal[style*="480px"] {
          animation: modalIn 0.7s cubic-bezier(.22,1,.36,1) both;
        }

        /* Override del body cuando estamos en login */
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
