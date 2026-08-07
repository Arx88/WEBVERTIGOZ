"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("¡Bienvenido!", {
        description: `Sesión iniciada como ${data.user?.email}`,
      });

      // Redirigir según el rol
      // TODO: obtener rol desde tabla account y redirigir a /admin o /mi-equipo
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
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-[#0a0011]">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-8 text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        <div className="text-center mb-10">
          <div className="label-premium text-gold/80 mb-2">INGRESAR</div>
          <h1 className="font-cinzel text-3xl mb-3 text-neon">
            Iniciar sesión
          </h1>
          <p className="text-text-secondary text-sm font-light">
            Accedé a tu cuenta para gestionar tu equipo, ver tus partidos y administrar el torneo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" strokeWidth={1.5} />
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" strokeWidth={1.5} />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="default"
            size="lg"
            className="w-full"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border-subtle text-center">
          <p className="text-text-secondary text-sm font-light">
            ¿No tenés equipo inscripto?{" "}
            <Link
              href="/registro"
              className="text-gold hover:text-gold-hover transition-colors underline-offset-4 hover:underline"
            >
              Inscríbete ahora
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
