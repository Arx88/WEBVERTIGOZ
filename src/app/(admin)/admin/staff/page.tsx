import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AlertCircle, ShieldCheck, Users } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { fmt } from "@/lib/format";
import StaffManager from "./staff-manager";
import StaffEnableForm from "./staff-enable-form";
import { listStaffAccounts } from "@/server/actions/ruleta";

export const dynamic = "force-dynamic";

/**
 * /admin/staff — Gestión de staff del torneo.
 *
 * El listado manda: cada admin se quita desde su propia fila (confirmación
 * en 2 pasos, sin inputs manuales de email). El alta por email va debajo.
 * Regla de oro: SOLO el ADMIN MAX (super_admin) puede otorgar o quitar
 * el rol — un admin común ve el panel en modo lectura.
 */

export default async function AdminStaffPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role, email, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const isSuperAdmin = account.role === "super_admin";
  const service = getSupabaseServiceRole() as any;
  const staff = (await listStaffAccounts(service)) as {
    id: string; email: string; display_name: string | null;
    role: "admin" | "super_admin"; created_at: string;
  }[];

  const admins = staff.filter((s) => s.role === "admin").length;
  const maxes = staff.filter((s) => s.role === "super_admin").length;

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="SOPORTE"
        title="Staff"
        desc="Quién administra el torneo. Cada admin tiene control del panel: aprobaciones, sorteos, resultados y disputas. Los ADMIN MAX están protegidos y solo ellos pueden cambiar esta lista."
        stats={[
          { value: admins, label: "Admins" },
          { value: maxes, label: "Admins MAX" },
          {
            value: isSuperAdmin ? "Sí" : "No",
            label: "Sos ADMIN MAX",
            color: isSuperAdmin ? "#fbbf24" : "var(--vertigo-faint)",
          },
        ]}
      />

      {!isSuperAdmin && (
        <div className="staff-readonly">
          <AlertCircle style={{ width: 15, height: 15, flex: "none" }} />
          Modo lectura: solo el ADMIN MAX puede habilitar o quitar administradores.
        </div>
      )}

      <div className="staff-sections">
        {/* Staff actual — protagonista */}
        <section>
          <header className="staff-sec-head">
            <Users style={{ width: 15, height: 15, color: "var(--vertigo-purple-soft)" }} />
            <div><h2>Staff actual</h2><p>Quién administra el torneo. El alta más reciente: {fmt.date(staff[staff.length - 1]?.created_at ?? null)}.</p></div>
            <span className="staff-count">{staff.length}</span>
          </header>
          <StaffManager staff={staff} isSuperAdmin={isSuperAdmin} myEmail={account.email} />
          <p className="staff-note">
            Los ADMIN MAX no se pueden quitar ni degradar desde acá — por diseño.
          </p>
        </section>

        {/* Alta */}
        <section>
          <header className="staff-sec-head">
            <ShieldCheck style={{ width: 15, height: 15, color: "var(--vertigo-purple-soft)" }} />
            <div><h2>Habilitar admin</h2><p>Por email. Si ya tiene cuenta, conserva su historial.</p></div>
          </header>
          <StaffEnableForm isSuperAdmin={isSuperAdmin} />
        </section>

        {/* Info compacta */}
        <section className="vertigo-card">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 flex-none" style={{ width: 18, height: 18, color: "var(--vertigo-purple-soft)" }} />
            <div>
              <div className="vertigo-card-title">¿Qué puede hacer un admin?</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--vertigo-muted)]">
                Aprobar o rechazar inscripciones, confirmar pagos, iniciar sorteos y ejecutar comodines en la stream,
                cargar resultados, gestionar casters, emblemas, handbook y notificaciones. Lo que NO puede: otorgar o
                quitar admins (solo ADMIN MAX), resolver disputas (solo ADMIN MAX) ni modificar otros ADMIN MAX.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
