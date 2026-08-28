import Link from "next/link";
import { redirect } from "next/navigation";
import { Mic, Swords, Ticket } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { listTrustedDevices } from "@/lib/device-trust";
import AuthShell from "@/components/auth/auth-shell";
import QuickAccess from "@/components/auth/quick-access";
import LoginForm from "@/components/auth/login-form";

/**
 * Login unificado. Si ya hay sesión, redirige según el rol de la cuenta
 * (el middleware ya no decide esto). Si no, muestra el acceso rápido
 * (cuentas recordadas en este navegador → entran con UN clic) y debajo
 * el formulario clásico.
 */
/** Destino pedido vía ?redirect= (lo pone el middleware al rechazar rutas). */
function destinoSeguro(raw: string | undefined): string | null {
  // Solo paths internos: empieza con "/" y no con "//" (open redirect).
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectParam } = await searchParams;
  const supabase = (await getSupabaseServer()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const pedido = destinoSeguro(redirectParam);
    if (pedido) redirect(pedido);
    const { data: account } = await supabase
      .from("account")
      .select("role")
      .eq("supabase_auth_id", user.id)
      .maybeSingle();
    const role = account?.role;
    if (role === "spectator") redirect("/apuestas");
    if (role === "caster") redirect("/casters");
    redirect("/mi-equipo");
  }

  const devices = await listTrustedDevices();

  return (
    <AuthShell
      closeHref="/"
      kicker="INGRESAR"
      title="Iniciar sesión"
      description="Accedé a tu cuenta para gestionar tu equipo, ver tus partidos y administrar el torneo."
      footer={
        <>
          <p className="auth-footer-title">¿No tenés equipo inscripto?</p>
          <Link href="/registro" className="auth-footer-cta">
            <Swords size={15} />
            Inscríbete ahora
          </Link>
          <div className="auth-alt">
            <Link href="/registro-espectador" className="auth-chip">
              <Ticket size={14} />
              Espectador
            </Link>
            <Link href="/registro-caster" className="auth-chip">
              <Mic size={14} />
              Quiero castear
            </Link>
          </div>
        </>
      }
    >
      <QuickAccess devices={devices} />
      <LoginForm />
    </AuthShell>
  );
}
