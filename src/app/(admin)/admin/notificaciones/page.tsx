import { redirect } from "next/navigation";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { Megaphone } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import BroadcastForm from "./broadcast-form";

export const dynamic = "force-dynamic";

/**
 * /admin/notificaciones — Broadcast del staff.
 * Crea notificaciones in-app (y emails opcionales) para toda una
 * audiencia: todos / capitanes / apostadores / jugadores / un equipo.
 * Los avisos llegan a la campana al instante (realtime) y quedan en
 * el historial de cada cuenta.
 */
export default async function AdminNotificacionesPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account").select("id, role, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) redirect("/mi-equipo");

  const service = getSupabaseServiceRole() as any;

  const [{ count: totalAll }, { count: totalBettors }, { count: totalPlayers }] = await Promise.all([
    service.from("account").select("id", { count: "exact", head: true }),
    service.from("account").select("id", { count: "exact", head: true }).eq("role", "spectator"),
    service.from("account").select("id", { count: "exact", head: true }).eq("role", "player"),
  ]);

  const { data: owners } = await service.from("team_account").select("owner_id").neq("owner_id", null);
  const captains = [...new Set((owners ?? []).map((o: any) => o.owner_id))].length;

  const { data: teams } = (await service
    .from("team_account")
    .select("id, name")
    .order("name", { ascending: true })) as { data: Array<{ id: string; name: string }> | null };

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="AVISOS"
        title="Notificaciones"
        desc="Mensaje directo a todos (o a un grupo): campaña, fase confirmada, cambio de horario, plaza liberada. Llega a la campana de cada cuenta al instante y, si marcás la casilla, también como email."
        stats={[
          { value: totalAll ?? 0, label: "Cuentas totales" },
          { value: captains, label: "Capitanes" },
          { value: totalBettors ?? 0, label: "Apostadores" },
          { value: totalPlayers ?? 0, label: "Jugadores" },
        ]}
      />
      <BroadcastForm teams={(teams ?? []) as { id: string; name: string }[]} />
    </div>
  );
}
