"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ensureDeviceTrustAction } from "@/server/actions/auth";

/**
 * Formulario de inicio de sesión. Al ingresar redirige según el rol:
 * espectador → /apuestas, caster → /casters, resto → /mi-equipo.
 * El acceso rápido de un clic vive en QuickAccess (server component);
 * acá solo se recuerda el navegador para la próxima vía device-trust.
 */
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || loading) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      let destino = "/mi-equipo";
      // ?redirect= lo pone el middleware al rechazar una ruta protegida:
      // después de loguearse, el usuario vuelve a donde quería ir.
      const pedido = new URLSearchParams(window.location.search).get("redirect");
      if (pedido && pedido.startsWith("/") && !pedido.startsWith("//")) {
        destino = pedido;
      } else if (data.user) {
        const { data: account } = await supabase
          .from("account")
          .select("role")
          .eq("supabase_auth_id", data.user.id)
          .maybeSingle();
        const role = (account as { role?: string } | null)?.role ?? "";
        if (role === "spectator") destino = "/apuestas";
        else if (role === "caster") destino = "/casters";
      }

      // Recordar este navegador para el acceso rápido de un clic.
      // Best-effort con timeout: si Supabase se cuelga acá, el login NO se
      // rompe — simplemente no queda cuenta recordada.
      try {
        await Promise.race([
          ensureDeviceTrustAction(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 5000),
          ),
        ]);
      } catch {
        /* noop: el acceso rápido queda desactivado, la sesión está viva */
      }

      toast.success("¡Bienvenido!", {
        description: `Sesión iniciada como ${data.user?.email}`,
      });
      router.push(destino);
      router.refresh();
    } catch (err) {
      toast.error("Error al iniciar sesión", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setLoading(false);
    }
  }

  const bloqueado = loading || !email || !password;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
      <div className="field" style={{ marginBottom: "20px" }}>
        <label htmlFor="email">Email</label>
        <div className="input-wrap">
          <Mail className="input-icon" size={16} />
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
      </div>

      <div className="field" style={{ marginBottom: "26px" }}>
        <label htmlFor="password">Contraseña</label>
        <div className="input-wrap">
          <Lock className="input-icon" size={16} />
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
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            style={{
              position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer",
              color: "#9a92a6", padding: "4px",
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
          opacity: bloqueado ? 0.5 : 1,
          cursor: bloqueado ? "not-allowed" : "pointer",
        }}
        disabled={bloqueado}
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
  );
}
