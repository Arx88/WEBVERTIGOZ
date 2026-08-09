import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import Link from "next/link";
import { LogOut, Calendar, Clock, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminJornadasPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) {
    redirect("/mi-equipo");
  }

  // Buscar todos los matches con su round y teams
  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id")
    .eq("slug", "vertigo-2026-1")
    .single()) as { data: any };

  let matchesByJornada: Record<string, any[]> = {};

  if (edition) {
    const { data: bracket } = (await supabase
      .from("bracket")
      .select("id")
      .eq("tournament_edition_id", edition.id)
      .single()) as { data: any };

    if (bracket) {
      const { data: rounds } = (await supabase
        .from("round")
        .select("id, name, index")
        .eq("bracket_id", bracket.id)
        .order("index", { ascending: true })) as { data: any[] };

      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map((r) => r.id);
        const { data: allMatches } = (await supabase
          .from("match")
          .select(`
            id, status, slot_index, scheduled_at_start, scheduled_at_end, jornada_label,
            team_a_id, team_b_id, score_a, score_b, winner_team_id,
            round:round_id (id, name, index)
          `)
          .in("round_id", roundIds)
          .order("slot_index", { ascending: true })) as { data: any[] };

        if (allMatches) {
          // Agrupar por jornada_label
          for (const m of allMatches) {
            const label = m.jornada_label ?? `Ronda ${m.round.index + 1}`;
            if (!matchesByJornada[label]) matchesByJornada[label] = [];
            matchesByJornada[label].push(m);
          }
        }
      }
    }
  }

  const jornadas = Object.entries(matchesByJornada).sort(([a], [b]) => a.localeCompare(b));
  const totalMatches = jornadas.reduce((sum, [, ms]) => sum + ms.length, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <span className="vertigo-kicker">JORNADAS</span>
          <h1 className="vertigo-title">Programación de partidos</h1>
        </div>
        <form action={logoutAction} style={{ display: "inline" }}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost">
            <LogOut size={14} style={{ display: "inline", marginRight: "6px" }} />
            Salir
          </button>
        </form>
      </div>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      {/* Stats */}
      <div className="vertigo-stats" style={{ marginBottom: "24px" }}>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">JORNADAS</div>
          <div className="vertigo-stat-value">{jornadas.length}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">PARTIDOS</div>
          <div className="vertigo-stat-value">{totalMatches}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">CON HORARIO</div>
          <div className="vertigo-stat-value">
            {jornadas.reduce((s, [, ms]) => s + ms.filter((m) => m.scheduled_at_start).length, 0)}
          </div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">SIN HORARIO</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-warning)" }}>
            {jornadas.reduce((s, [, ms]) => s + ms.filter((m) => !m.scheduled_at_start).length, 0)}
          </div>
        </div>
      </div>

      {/* Lista de jornadas */}
      {jornadas.length === 0 ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <div className="vertigo-empty-title">No hay partidos programados</div>
            <p className="vertigo-empty-desc">
              Generá el bracket primero desde <Link href="/admin/bracket" style={{ color: "var(--vertigo-purple-soft)" }}>Bracket</Link> para
              poder programar jornadas.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {jornadas.map(([jornadaLabel, matches]) => (
            <section key={jornadaLabel}>
              <h2 className="vertigo-subtitle" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Calendar size={16} />
                {jornadaLabel}
                <span style={{ fontSize: "11px", color: "var(--vertigo-muted)", fontWeight: 400 }}>
                  ({matches.length} partidos)
                </span>
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {matches.map((m) => {
                  const statusColors: Record<string, string> = {
                    scheduled: "#4A6FA5",
                    open: "#22c55e",
                    drawing: "#fbbf24",
                    lineup: "#a78bfa",
                    comodin_window: "#fbbf24",
                    in_progress: "#ef4444",
                    finished: "#22c55e",
                    disputed: "#ef4444",
                    forfeit: "#6b7280",
                    cancelled: "#6b7280",
                  };
                  const color = statusColors[m.status] ?? "#6b7280";

                  return (
                    <Link
                      key={m.id}
                      href={`/admin/partido/${m.id}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "var(--vertigo-panel)",
                        borderRadius: "10px",
                        border: `1px solid ${color}44`,
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{
                          fontSize: "10px",
                          padding: "3px 8px",
                          background: `${color}22`,
                          color: color,
                          borderRadius: "999px",
                          fontWeight: 700,
                        }}>
                          {m.status.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", color: "var(--vertigo-text)" }}>
                            {m.round?.name} · Match #{m.slot_index + 1}
                          </div>
                          {m.scheduled_at_start && (
                            <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={10} />
                              {new Date(m.scheduled_at_start).toLocaleString("es-AR", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                        <span style={{ color: m.winner_team_id === m.team_a_id ? "var(--vertigo-success)" : "var(--vertigo-text)" }}>
                          {m.team_a_id ? "Team A" : "—"}
                        </span>
                        <span style={{ color: "var(--vertigo-muted)" }}>vs</span>
                        <span style={{ color: m.winner_team_id === m.team_b_id ? "var(--vertigo-success)" : "var(--vertigo-text)" }}>
                          {m.team_b_id ? "Team B" : "—"}
                        </span>
                        {(m.score_a > 0 || m.score_b > 0) && (
                          <span style={{ marginLeft: "8px", color: "var(--vertigo-muted)" }}>
                            {m.score_a}-{m.score_b}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Nota */}
      <section style={{ marginTop: "32px" }}>
        <div style={{
          padding: "16px",
          background: "rgba(124,58,237,0.05)",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: "12px",
        }}>
          <h3 style={{ fontSize: "14px", color: "var(--vertigo-purple-soft)", marginBottom: "8px" }}>
            📅 Asignación de horarios
          </h3>
          <p style={{ fontSize: "13px", color: "var(--vertigo-muted)", lineHeight: 1.5 }}>
            Para asignar horarios y casters a un partido, abrí el partido individual desde el bracket o
            hacé click en cualquier partido de esta lista. La edición de horarios se agregará como
            campo editable directamente en la página del partido.
          </p>
        </div>
      </section>
    </div>
  );
}
