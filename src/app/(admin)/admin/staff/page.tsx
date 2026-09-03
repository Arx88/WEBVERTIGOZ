import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AlertCircle, ShieldCheck, Users } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { fmt } from "@/lib/format";
import StaffTable from "./staff-table";
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
        <div className="vertigo-card mb-8" style={{ border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)" }}>
          <div className="flex items-center gap-3 text-sm" style={{ color: "#fbbf24" }}>
            <AlertCircle style={{ width: 16, height: 16, flex: "none" }} />
            Modo lectura: solo el ADMIN MAX puede habilitar o quitar administradores.
          </div>
        </div>
      )}

      <div className="flex flex-col gap-10">
        {/* Staff actual — protagonista */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <Users style={{ width: 15, height: 15, color: "var(--vertigo-purple-soft)" }} />
            <h2 className="font-cinzel text-base" style={{ color: "var(--vertigo-text)" }}>Staff actual</h2>
            <span className="ad-section-count">{staff.length}</span>
            <span className="h-px flex-1" style={{ background: "var(--vertigo-line-soft)" }} />
          </div>
          <StaffTable staff={staff} isSuperAdmin={isSuperAdmin} myEmail={account.email} />
          <p className="mt-3 text-[11px]" style={{ color: "var(--vertigo-faint)" }}>
            El alta más reciente: {fmt.date(staff[staff.length - 1]?.created_at ?? null)}. Los ADMIN MAX no se pueden
            quitar ni degradar desde acá — por diseño.
          </p>
        </section>

        {/* Alta */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck style={{ width: 15, height: 15, color: "var(--vertigo-purple-soft)" }} />
            <h2 className="font-cinzel text-base" style={{ color: "var(--vertigo-text)" }}>Habilitar admin</h2>
            <span className="h-px flex-1" style={{ background: "var(--vertigo-line-soft)" }} />
          </div>
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
