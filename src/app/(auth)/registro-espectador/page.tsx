"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail, Mic, Swords, User } from "lucide-react";
import { registerSpectatorAction } from "@/server/actions/apuestas";
import { WELCOME_POINTS } from "@/lib/constants";
import AuthShell from "@/components/auth/auth-shell";

export default function RegistroEspectadorPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    displayName.trim().length > 0 && email.includes("@") && password.length >= 6;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const result = await registerSpectatorAction(new FormData(e.currentTarget));
      if (!result.ok) {
        toast.error("No pudimos registrarte", { description: result.error });
        return;
      }
      toast.success("¡Bienvenido al vértigo!", {
        description: `Recibiste ${WELCOME_POINTS} puntos para apostar en las llaves.`,
      });
      router.push("/apuestas");
      router.refresh();
    } catch (err) {
      toast.error("No pudimos registrarte", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      closeHref="/login"
      kicker="ESPECTADORES"
      title="Crear cuenta de espectador"
      description={
        <>
          Al registrarte recibís{" "}
          <strong style={{ color: "var(--purple-soft)" }}>{WELCOME_POINTS} puntos</strong> para
          apostar a qué equipo gana cada llave.
        </>
      }
      mainLabel="Nueva cuenta"
      footer={
        <>
          <p className="auth-footer-title">¿Ya tenés cuenta?</p>
          <Link href="/login" className="auth-footer-cta">
            <LogIn size={15} />
            Iniciar sesión
          </Link>
          <div className="auth-alt">
            <Link href="/registro" className="auth-chip">
              <Swords size={14} />
              Inscribir equipo
            </Link>
            <Link href="/registro-caster" className="auth-chip">
              <Mic size={14} />
              Quiero castear
            </Link>
          </div>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
        <div className="field" style={{ marginBottom: "18px" }}>
          <label htmlFor="display_name">Nombre para el ranking</label>
          <div className="input-wrap">
            <User className="input-icon" size={16} />
            <input
              id="display_name"
              name="display_name"
              type="text"
              placeholder="Ej: El Oráculo del Vértigo"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="field" style={{ marginBottom: "18px" }}>
          <label htmlFor="email">Email</label>
          <div className="input-wrap">
            <Mail className="input-icon" size={16} />
            <input
              id="email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="field" style={{ marginBottom: "26px" }}>
          <label htmlFor="password">Contraseña</label>
          <div className="input-wrap">
            <Lock className="input-icon" size={16} />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              disabled={loading}
              style={{ paddingRight: "48px" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
            opacity: loading || !canSubmit ? 0.5 : 1,
            cursor: loading || !canSubmit ? "not-allowed" : "pointer",
          }}
          disabled={loading || !canSubmit}
        >
          {loading ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              CREANDO CUENTA...
            </>
          ) : (
            `CREAR CUENTA · RECIBIR ${WELCOME_POINTS} PUNTOS`
          )}
        </button>
      </form>
    </AuthShell>
  );
}
