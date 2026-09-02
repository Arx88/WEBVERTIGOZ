"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail, Mic, Swords, Ticket, User } from "lucide-react";
import { registerCasterAction } from "@/server/actions/auth";
import AuthShell from "@/components/auth/auth-shell";

export default function RegistroCasterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twitch, setTwitch] = useState("");
  const [youtube, setYoutube] = useState("");
  const [kick, setKick] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    displayName.trim().length > 0 &&
    email.includes("@") &&
    password.length >= 6 &&
    (twitch.trim().length > 0 || youtube.trim().length > 0 || kick.trim().length > 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const result = await registerCasterAction(new FormData(e.currentTarget));
      if (!result.ok) {
        toast.error("No pudimos registrarte", { description: result.error });
        return;
      }
      toast.success("¡Bienvenido al staff de casters!", {
        description: "Tu perfil ya está visible en /casters.",
      });
      router.push("/casters");
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
      kicker="CASTERS"
      title="Quiero castear"
      description="Creá tu perfil de caster y quedá visible en la página de casters. Cargá al menos un canal."
      mainLabel="Nueva cuenta"
      footer={
        <>
          <p className="auth-footer-title">¿Ya tenés cuenta?</p>
          <Link href="/login" className="auth-footer-cta">
            <LogIn size={15} />
            Iniciar sesión
          </Link>
          <div className="auth-alt">
            <Link href="/registro-espectador" className="auth-chip">
              <Ticket size={14} />
              Espectador
            </Link>
            <Link href="/registro" className="auth-chip">
              <Swords size={14} />
              Inscribir equipo
            </Link>
          </div>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
        <div className="field" style={{ marginBottom: "16px" }}>
          <label htmlFor="display_name">Nombre de caster</label>
          <div className="input-wrap">
            <User className="input-icon" size={16} />
            <input
              id="display_name"
              name="display_name"
              type="text"
              placeholder="Ej: La Voz del Vértigo"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="field" style={{ marginBottom: "16px" }}>
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

        <div className="field" style={{ marginBottom: "16px" }}>
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
              {showPassword ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Canales — una fila compacta para acortar el formulario */}
        <div
          style={{
            padding: "14px", marginBottom: "20px",
            border: "1px solid var(--line-soft)", borderRadius: "12px",
            background: "rgba(19, 15, 27, 0.4)",
          }}
        >
          <div
            style={{
              fontSize: "11px", fontWeight: 700, letterSpacing: "2px",
              textTransform: "uppercase", color: "#6b6378", marginBottom: "10px",
            }}
          >
            Tus canales · al menos uno
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <input
                id="twitch_channel"
                name="twitch_channel"
                type="text"
                aria-label="Usuario de Twitch"
                placeholder="Twitch"
                title="Usuario de Twitch (sin URL)"
                value={twitch}
                onChange={(e) => setTwitch(e.target.value)}
                maxLength={100}
                disabled={loading}
                style={{ height: "44px", padding: "0 12px", fontSize: "13px" }}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <input
                id="youtube_channel"
                name="youtube_channel"
                type="text"
                aria-label="Canal de YouTube"
                placeholder="YouTube"
                title="Canal de YouTube"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                maxLength={100}
                disabled={loading}
                style={{ height: "44px", padding: "0 12px", fontSize: "13px" }}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <input
                id="kick_channel"
                name="kick_channel"
                type="text"
                aria-label="Usuario de Kick"
                placeholder="Kick"
                title="Usuario de Kick"
                value={kick}
                onChange={(e) => setKick(e.target.value)}
                maxLength={100}
                disabled={loading}
                style={{ height: "44px", padding: "0 12px", fontSize: "13px" }}
              />
            </div>
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
              CREANDO PERFIL...
            </>
          ) : (
            <>
              <Mic size={15} />
              CREAR PERFIL DE CASTER
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
