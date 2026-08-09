"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2 } from "lucide-react";

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
    <div className="vertigo-page" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "28px" }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img src="/landing/logo.png" alt="VÉRTIGO Cup" style={{ width: "160px", margin: "0 auto", display: "block" }} />
        </div>

        <span className="vertigo-kicker">INGRESAR</span>
        <h1 className="vertigo-title" style={{ fontSize: "24px", marginBottom: "6px" }}>Iniciar sesión</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc" style={{ marginBottom: "28px" }}>
          Accedé a tu cuenta para gestionar tu equipo, ver tus partidos y administrar el torneo.
        </p>

        <form onSubmit={handleSubmit} className="vertigo-scroll" style={{ maxHeight: "none" }}>
          <div className="vertigo-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="tu@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={loading} />
          </div>
          <div className="vertigo-field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required disabled={loading} />
          </div>
          <button type="submit" className="vertigo-btn vertigo-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }} disabled={loading || !email || !password}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "INGRESAR"}
          </button>
        </form>

        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--vertigo-line-soft)", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--vertigo-muted)", fontFamily: "Inter, sans-serif" }}>
            ¿No tenés equipo inscripto?{" "}
            <Link href="/registro" style={{ color: "var(--vertigo-purple-soft)", textDecoration: "none" }}>Inscríbete ahora →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
