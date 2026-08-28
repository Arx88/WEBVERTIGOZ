import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { BellRing } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import WaitlistTable from "./waitlist-client";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * /admin/waitlist — Lista de espera de cupo (cupo_waitlist, migraciones
 * 0013/0015). Emails anotados desde el freno del wizard cuando la edición
 * quedó llena: el cron /api/cron/payment-deadline los notifica solos cuando
 * se libera lugar (expiración por falta de pago o rechazo del admin).
 */
export default async function AdminWaitlistPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account").select("id, role, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) redirect("/mi-equipo");

  const { data: rows } = (await supabase
    .from("cupo_waitlist")
    .select("id, email, source, notified_at, created_at, tournament_edition:tournament_edition_id ( id, name, status )")
    .order("created_at", { ascending: false })) as { data: any };

  const list = ((rows ?? []) as any[]).map((r: any) => ({
    id: r.id as string,
    email: r.email as string,
    source: (r.source ?? "") as string,
    notifiedAt: (r.notified_at ?? null) as string | null,
    createdAt: r.created_at as string,
    editionId: r.tournament_edition?.id as string | null,
    editionName: (r.tournament_edition?.name ?? "—") as string,
    editionStatus: (r.tournament_edition?.status ?? "") as string,
  }));

  const notificados = list.filter((r) => !!r.notifiedAt).length;
  const pendientes = list.length - notificados;

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="CUPO"
        title="Lista de espera"
        desc="Emails anotados desde el wizard cuando la edición quedó sin lugares. Cuando se libera una plaza (pago vencido o rechazo), el cron los notifica solos — cada email una sola vez por edición."
        stats={[
          { value: list.length, label: "Anotados" },
          { value: pendientes, label: "Sin avisar", color: pendientes > 0 ? "#fbbf24" : undefined },
          { value: notificados, label: "Notificados", color: "var(--vertigo-success)" },
        ]}
      />

      {list.length === 0 ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <BellRing className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
            <div className="vertigo-empty-title">Nadie en la lista de espera</div>
            <p className="vertigo-empty-desc">
              Cuando el cupo de una edición se llene, el wizard les ofrece a los interesados anotarse para recibir un
              aviso si se libera lugar. Esos emails van a aparecer acá.
            </p>
          </div>
        </div>
      ) : (
        <WaitlistTable rows={list} />
      )}

      <p className="mt-6 text-[11px] text-[var(--vertigo-faint)]">
        Última lectura: {fmt.date(new Date())}. Circuito automático: expiración de pago (cron horario) o rechazo del
        staff → lugar libre → email a los anotados pendientes (FIFO) → quedan marcados como notificados.
      </p>
    </div>
  );
}
