import { redirect } from "next/navigation";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import AdminHero from "@/components/shared/admin-hero";
import BroadcastComposer from "./broadcast-composer";
import BroadcastHistory from "./broadcast-history";

export const dynamic = "force-dynamic";

/**
 * /admin/notificaciones — Broadcast del staff (rediseño 2026-09).
 *
 * Layout de 2 columnas: a la izquierda el composer (con modal de
 * confirmación y alcance estimado), a la derecha una vista previa que
 * ESPEJA la campana real de los usuarios. Abajo, el historial de envíos
 * con contadores por audiencia y filas plegables.
 *
 * Crea notificaciones in-app (y emails opcionales) para toda una
 * audiencia: todos / capitanes / apostadores / jugadores / casters /
 * un equipo. Los avisos llegan a la campana al instante (realtime) y
 * quedan en el historial de cada cuenta. Cada envío queda registrado
 * en broadcast_log con su emisor.
 */
export default async function AdminNotificacionesPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account").select("id, role, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) redirect("/mi-equipo");

  const service = getSupabaseServiceRole() as any;

  // Conteos de audiencia: alimentan tanto los stats del hero como el
  // "alcance estimado" que muestra el composer antes de enviar.
  const [{ count: totalAll }, { count: totalBettors }, { count: totalPlayers }, { count: totalCasters }] =
    await Promise.all([
      service.from("account").select("id", { count: "exact", head: true }),
      service.from("account").select("id", { count: "exact", head: true }).eq("role", "spectator"),
      service.from("account").select("id", { count: "exact", head: true }).eq("role", "player"),
      service.from("caster").select("id", { count: "exact", head: true }),
    ]);

  const { data: owners } = await service.from("team_account").select("owner_id").neq("owner_id", null);
  const captains = [...new Set((owners ?? []).map((o: any) => o.owner_id))].length;

  // Alcance real del canal push: cuántas cuentas tienen al menos una
  // suscripción activa (push_subscription, migración 2026-09-04).
  const { data: pushAccounts } = await service
    .from("push_subscription")
    .select("account_id");
  const pushIds = new Set((pushAccounts ?? []).map((p: any) => p.account_id));
  const pushAccountsCount = pushIds.size;

  // Desglose push por audiencia + muestras para el builder visual.
  // Sin migraciones: se deriva de account/caster/team_account existentes.
  const { data: casterRows } = await service.from("caster").select("account_id");
  const casterIds = new Set((casterRows ?? []).map((c: any) => c.account_id));
  const { data: sampleAccounts } = (await service
    .from("account")
    .select("id, role, display_name")
    .limit(2000)) as { data: Array<{ id: string; role: string; display_name: string | null }> | null };
  const byId = new Map((sampleAccounts ?? []).map((a) => [a.id, a]));
  const pushOf = (ids: string[]) => ids.filter((id) => pushIds.has(id)).length;
  const bettorIds = (sampleAccounts ?? []).filter((a) => a.role === "spectator").map((a) => a.id);
  const playerIds = (sampleAccounts ?? []).filter((a) => a.role === "player").map((a) => a.id);
  const ownerIds = [...new Set((owners ?? []).map((o: any) => o.owner_id).filter(Boolean))] as string[];
  const casterIdList = [...casterIds] as string[];
  const pushBreakdown = {
    all: pushAccountsCount,
    captains: pushOf(ownerIds),
    bettors: pushOf(bettorIds),
    players: pushOf(playerIds),
    casters: pushOf(casterIdList),
  };
  const pickNames = (ids: string[], n = 5) =>
    ids.map((id) => byId.get(id)?.display_name || "Cuenta").filter(Boolean).slice(0, n);
  const samples: Record<string, string[]> = {
    all: ((sampleAccounts ?? []).slice(0, 5).map((a) => a.display_name || "Cuenta")),
    captains: pickNames(ownerIds),
    bettors: pickNames(bettorIds),
    players: pickNames(playerIds),
    casters: pickNames(casterIdList),
  };

  const { data: teams } = (await service
    .from("team_account")
    .select("id, name")
    .order("name", { ascending: true })) as { data: Array<{ id: string; name: string }> | null };

  const { data: logRows } = (await service
    .from("broadcast_log")
    .select(
      "id, audience, type, title, body, link, email_sent, targets, sent_at, sent_by:sent_by_account_id ( display_name, email )",
    )
    .order("sent_at", { ascending: false })
    .limit(50)) as { data: any };

  // Avisos programados pendientes: se muestran arriba del historial con
  // acción de cancelar (el cron /api/cron/scheduled-broadcasts los entrega).
  const { data: scheduledRows } = (await service
    .from("scheduled_broadcast")
    .select("id, audience, title, email, scheduled_for")
    .eq("status", "pending")
    .gte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(10)) as { data: any };

  const reach = {
    all: totalAll ?? 0,
    captains,
    bettors: totalBettors ?? 0,
    players: totalPlayers ?? 0,
    casters: totalCasters ?? 0,
  };
  const pushPct = reach.all > 0 ? Math.round((pushAccountsCount / reach.all) * 100) : 0;

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="AVISOS"
        title="Notificaciones"
        desc="Redactá un aviso, previsualizalo tal como llega a la campana de cada cuenta y confirmá antes de enviar. Opcionalmente también como email. Cada envío queda registrado en el historial de abajo."
        stats={[
          { value: reach.all, label: "Cuentas" },
          { value: reach.captains, label: "Capitanes" },
          { value: reach.bettors, label: "Apostadores" },
          { value: reach.players, label: "Jugadores" },
          { value: `${pushAccountsCount} (${pushPct}%)`, label: "Con push activa" },
        ]}
      />

      <div id="redactar" style={{ scrollMarginTop: 24 }}>
        <BroadcastComposer
          teams={(teams ?? []) as { id: string; name: string }[]}
          reach={reach}
          push={pushBreakdown}
          pushPct={pushPct}
          samples={samples}
          scheduled={(scheduledRows ?? []) as any[]}
          recent={(logRows ?? []).slice(0, 10) as any[]}
        />
      </div>

      <BroadcastHistory rows={(logRows ?? []) as any[]} scheduled={(scheduledRows ?? []) as any[]} />
    </div>
  );
}
