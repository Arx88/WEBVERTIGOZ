import { redirect } from "next/navigation";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { History, Megaphone } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import BroadcastForm from "./broadcast-form";

export const dynamic = "force-dynamic";

/**
 * /admin/notificaciones — Broadcast del staff.
 * Crea notificaciones in-app (y emails opcionales) para toda una
 * audiencia: todos / capitanes / apostadores / jugadores / casters /
 * un equipo. Los avisos llegan a la campana al instante (realtime) y
 * quedan en el historial de cada cuenta. Cada envío queda registrado
 * en el historial del panel (broadcast_log) con su emisor.
 */
export default async function AdminNotificacionesPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account").select("id, role, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) redirect("/mi-equipo");

  const service = getSupabaseServiceRole() as any;

  const [{ count: totalAll }, { count: totalBettors }, { count: totalPlayers }, { count: totalCasters }] = await Promise.all([
    service.from("account").select("id", { count: "exact", head: true }),
    service.from("account").select("id", { count: "exact", head: true }).eq("role", "spectator"),
    service.from("account").select("id", { count: "exact", head: true }).eq("role", "player"),
    service.from("caster").select("id", { count: "exact", head: true }),
  ]);

  const { data: owners } = await service.from("team_account").select("owner_id").neq("owner_id", null);
  const captains = [...new Set((owners ?? []).map((o: any) => o.owner_id))].length;

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
    .limit(25)) as { data: any };

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="AVISOS"
        title="Notificaciones"
        desc="Mensaje directo a todos (o a un grupo): campaña, fase confirmada, cambio de horario, plaza liberada. Llega a la campana de cada cuenta al instante y, si marcás la casilla, también como email. 'Probar a mí' te muestra el aviso exacto en tu propia campana antes de mandarlo."
        stats={[
          { value: totalAll ?? 0, label: "Cuentas totales" },
          { value: captains, label: "Capitanes" },
          { value: totalBettors ?? 0, label: "Apostadores" },
          { value: totalPlayers ?? 0, label: "Jugadores" },
          { value: totalCasters ?? 0, label: "Casters" },
        ]}
      />
      <BroadcastForm teams={(teams ?? []) as { id: string; name: string }[]} />
      <HistoryCard rows={logRows ?? []} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Historial de envíos — qué se mandó, a quién, cuándo y por quién
// ─────────────────────────────────────────────────────────────

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Todos",
  captains: "Capitanes",
  bettors: "Apostadores",
  players: "Jugadores",
  casters: "Casters",
  team: "Equipo",
};

const TYPE_LABEL: Record<string, string> = {
  broadcast: "Aviso general",
  match_phase: "Fase / partido",
  match_scheduled: "Programado",
  bet_open: "Apuestas",
};

function HistoryCard({ rows }: { rows: any[] }) {
  return (
    <div className="vertigo-card" style={{ maxWidth: 820, marginTop: 24, padding: 0, overflow: "hidden" }}>
      <div className="vertigo-card-title" style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 24px 0" }}>
        <History size={18} style={{ color: "var(--vertigo-purple-soft)" }} />
        Historial de envíos
      </div>

      {rows.length === 0 ? (
        <div className="vertigo-empty" style={{ padding: "36px 24px 42px" }}>
          <History
            className="mx-auto mb-4"
            style={{ width: 44, height: 44, color: "var(--vertigo-faint)" }}
            strokeWidth={1}
          />
          <div className="vertigo-empty-title">Todavía no enviaste ningún aviso</div>
          <p className="vertigo-empty-desc">
            Cada broadcast queda registrado acá, con el emisor, la audiencia y el horario.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {rows.map((r: any, i: number) => {
            const sender =
              r.sent_by?.display_name || r.sent_by?.email?.split("@")[0] || "Cuenta eliminada";
            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "14px 24px",
                  borderTop: "1px solid var(--vertigo-line-soft)",
                  alignItems: "flex-start",
                }}
              >
                <span
                  className="vertigo-badge vertigo-badge-purple"
                  style={{ fontSize: 9, padding: "3px 10px", flex: "none", marginTop: 1 }}
                >
                  {AUDIENCE_LABEL[r.audience] ?? r.audience}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span className="text-[13px] font-semibold text-[var(--vertigo-text)]">{r.title}</span>
                    {r.email_sent && (
                      <span
                        className="vertigo-badge vertigo-badge-success"
                        style={{ fontSize: 8, padding: "2px 8px" }}
                      >
                        EMAIL
                      </span>
                    )}
                  </div>
                  {r.body && (
                    <p
                      className="mt-1 text-[12px] leading-relaxed text-[var(--vertigo-muted)]"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {r.body}
                    </p>
                  )}
                  <p className="mt-1.5 text-[10.5px] text-[var(--vertigo-faint)]">
                    por <span style={{ color: "var(--vertigo-purple-soft)", fontWeight: 600 }}>{sender}</span>
                    {" · "}
                    {TYPE_LABEL[r.type] ?? r.type}
                    {" · "}
                    {new Date(r.sent_at).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {r.targets} destinatario{r.targets === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}