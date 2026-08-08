import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction, approveTeamAction, rejectTeamAction } from "@/server/actions/auth";
import { Shield, Check, X, Users, LogOut } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminEquiposPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account").select("id, role, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) redirect("/mi-equipo");

  const { data: registrations } = (await supabase
    .from("team_registration")
    .select("id, status, elo_freeze_snapshot, elo_verification_status, elo_verification_reason, submitted_at, approved_at, team_account:team_account_id (id, name, tagline, emblem_id), tournament_edition:tournament_edition_id (name, elo_cap, elo_tolerance)")
    .order("submitted_at", { ascending: false })) as { data: any };

  const regsWithPlayers = await Promise.all(
    (registrations ?? []).map(async (reg: any) => {
      const { data: players } = (await supabase
        .from("player_registration")
        .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, is_verified, aoe2_profile_id")
        .eq("team_registration_id", reg.id).order("is_captain", { ascending: false })) as { data: any };
      return { ...reg, players: players ?? [] };
    })
  );

  const pending = regsWithPlayers.filter((r: any) => r.status === "pending");
  const approved = regsWithPlayers.filter((r: any) => r.status === "approved");
  const rejected = regsWithPlayers.filter((r: any) => r.status === "rejected");

  return (
    <div>
      <span className="vertigo-kicker">INSCRIPCIONES</span>
      <h1 className="vertigo-title">Equipos</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      {/* Stats */}
      <div className="vertigo-stats">
        <div className="vertigo-stat"><div className="vertigo-stat-label">TOTAL</div><div className="vertigo-stat-value">{regsWithPlayers.length}</div></div>
        <div className="vertigo-stat"><div className="vertigo-stat-label">PENDIENTES</div><div className="vertigo-stat-value" style={{ color: "#fbbf24" }}>{pending.length}</div></div>
        <div className="vertigo-stat"><div className="vertigo-stat-label">APROBADOS</div><div className="vertigo-stat-value" style={{ color: "var(--vertigo-success)" }}>{approved.length}</div></div>
        <div className="vertigo-stat"><div className="vertigo-stat-label">RECHAZADOS</div><div className="vertigo-stat-value" style={{ color: "var(--vertigo-danger)" }}>{rejected.length}</div></div>
      </div>

      {/* Pendientes */}
      {pending.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div className="vertigo-card-title" style={{ marginBottom: "16px" }}>Pendientes de aprobación</div>
          {pending.map((reg: any) => <TeamCard key={reg.id} reg={reg} showActions={true} approveAction={approveTeamAction.bind(null, reg.id)} rejectAction={rejectTeamAction.bind(null, reg.id)} />)}
        </div>
      )}

      {/* Aprobados */}
      {approved.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div className="vertigo-card-title" style={{ marginBottom: "16px" }}>Aprobados</div>
          {approved.map((reg: any) => <TeamCard key={reg.id} reg={reg} showActions={false} />)}
        </div>
      )}

      {/* Rechazados */}
      {rejected.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div className="vertigo-card-title" style={{ marginBottom: "16px" }}>Rechazados</div>
          {rejected.map((reg: any) => <TeamCard key={reg.id} reg={reg} showActions={false} />)}
        </div>
      )}

      {regsWithPlayers.length === 0 && (
        <div className="vertigo-empty">
          <Users style={{ width: "48px", height: "48px", color: "var(--vertigo-faint)", margin: "0 auto 16px" }} strokeWidth={1} />
          <div className="vertigo-empty-title">Sin inscripciones</div>
          <p className="vertigo-empty-desc">Todavía no hay equipos inscriptos. Cuando empiecen a registrarse, vas a verlos acá.</p>
        </div>
      )}
    </div>
  );
}

function TeamCard({ reg, showActions, approveAction, rejectAction }: { reg: any; showActions: boolean; approveAction?: () => Promise<void>; rejectAction?: () => Promise<void>; }) {
  const team = reg.team_account;
  const edition = reg.tournament_edition;
  const players = reg.players ?? [];
  const eloCap = (edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20);
  const isEloOk = !reg.elo_freeze_snapshot || reg.elo_freeze_snapshot <= eloCap;

  return (
    <div className="vertigo-card" style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", border: "1px solid var(--vertigo-purple)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--vertigo-purple-soft)" }}>
            <Shield style={{ width: "20px", height: "20px" }} strokeWidth={1.25} />
          </div>
          <div>
            <div style={{ fontFamily: "Cinzel, serif", fontSize: "18px", fontWeight: 600, color: "var(--vertigo-text)" }}>{team?.name ?? "—"}</div>
            {team?.tagline && <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", fontStyle: "italic" }}>&ldquo;{team.tagline}&rdquo;</div>}
            <div style={{ fontSize: "11px", color: "var(--vertigo-faint)", marginTop: "4px" }}>{edition?.name ?? "—"} · Enviado {reg.submitted_at ? new Date(reg.submitted_at).toLocaleDateString("es-AR") : "—"}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "var(--vertigo-faint)", letterSpacing: "1.7px", textTransform: "uppercase" }}>ELO TOTAL</div>
          <div style={{ fontFamily: "Cinzel, serif", fontSize: "22px", fontWeight: 700, color: isEloOk ? "var(--vertigo-purple-pale)" : "var(--vertigo-danger)" }}>{reg.elo_freeze_snapshot ?? "—"}</div>
          <div style={{ fontSize: "11px", color: "var(--vertigo-faint)" }}>/ {eloCap}</div>
        </div>
      </div>

      {reg.elo_verification_status === "pending" && <div style={{ padding: "8px 12px", border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)", borderRadius: "6px", fontSize: "12px", color: "#fbbf24", marginBottom: "12px" }}>Falta verificación de ELO — al menos un jugador tiene el perfil oculto</div>}
      {reg.elo_verification_status === "failed" && <div style={{ padding: "8px 12px", border: "1px solid rgba(251,113,133,0.3)", background: "rgba(251,113,133,0.06)", borderRadius: "6px", fontSize: "12px", color: "var(--vertigo-danger)", marginBottom: "12px" }}>Falló la verificación: {reg.elo_verification_reason ?? "Error"}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
        {players.map((p: any) => (
          <div key={p.id} style={{ padding: "8px", border: "1px solid var(--vertigo-line-soft)", borderRadius: "6px", fontSize: "11px" }}>
            <div style={{ fontWeight: 600, color: "var(--vertigo-text)" }}>{p.is_captain && "★ "}{p.display_name}</div>
            <div style={{ color: "var(--vertigo-faint)" }}>{p.country} · #{p.aoe2_profile_id}{p.max_rating_rm_1v1 !== null && <span style={{ color: "var(--vertigo-purple-soft)", marginLeft: "8px" }}>ELO: {p.max_rating_rm_1v1}</span>}</div>
          </div>
        ))}
      </div>

      {showActions && (
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--vertigo-line-soft)" }}>
          <form action={approveAction!}><button type="submit" className="vertigo-btn vertigo-btn-success"><Check style={{ width: "14px", height: "14px" }} />Aprobar</button></form>
          <form action={rejectAction!}><button type="submit" className="vertigo-btn vertigo-btn-danger"><X style={{ width: "14px", height: "14px" }} />Rechazar</button></form>
        </div>
      )}
    </div>
  );
}
