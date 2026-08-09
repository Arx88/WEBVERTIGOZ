import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JugadorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = (await getSupabaseServer()) as any;

  // Buscar player_registration
  const { data: player } = (await supabase
    .from("player_registration")
    .select(`
      id, display_name, country, clan, is_captain, max_rating_rm_1v1,
      rating_rm_1v1_current, aoe2_profile_id, is_verified,
      team_registration:team_registration_id (
        id, seed, elo_freeze_snapshot,
        team_account:team_account_id (id, name, tagline, emblem_id),
        tournament_edition:tournament_edition_id (id, name)
      )
    `)
    .eq("id", id)
    .single()) as { data: any };

  if (!player) {
    notFound();
  }

  // Buscar partidas donde el team del jugador participó
  const teamRegId = player.team_registration?.id;
  let matches: any[] = [];
  if (teamRegId) {
    const { data: matchesData } = (await supabase
      .from("match")
      .select(`
        id, status, scheduled_at_start, score_a, score_b, winner_team_id, format,
        team_a_id, team_b_id,
        round:round_id (id, name, index)
      `)
      .or(`team_a_id.eq.${teamRegId},team_b_id.eq.${teamRegId}`)
      .in("status", ["finished", "forfeit"])
      .order("scheduled_at_start", { ascending: false })
      .limit(20)) as { data: any[] };

    matches = matchesData ?? [];

    // Enriquecer con nombres de rivales
    const rivalIds = matches.map((m) =>
      m.team_a_id === teamRegId ? m.team_b_id : m.team_a_id
    ).filter(Boolean);

    if (rivalIds.length > 0) {
      const { data: rivalsData } = (await supabase
        .from("team_registration")
        .select(`id, team_account:team_account_id (id, name)`)
        .in("id", rivalIds)) as { data: any[] };

      const rivalsMap: Record<string, any> = {};
      rivalsData?.forEach((r) => { rivalsMap[r.id] = r; });
      matches = matches.map((m) => ({
        ...m,
        rival: rivalsMap[m.team_a_id === teamRegId ? m.team_b_id : m.team_a_id],
      }));
    }
  }

  const wins = matches.filter((m) => m.winner_team_id === teamRegId).length;
  const losses = matches.filter((m) => m.winner_team_id !== teamRegId && m.winner_team_id !== null).length;

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <div style={{ marginBottom: "24px" }}>
        <Link href={`/equipos/${teamRegId}`} style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver al equipo
        </Link>
      </div>

      {/* Header */}
      <section style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        padding: "24px",
        background: "var(--vertigo-panel)",
        borderRadius: "16px",
        border: "1px solid var(--vertigo-line)",
        marginBottom: "32px",
      }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "var(--vertigo-bg)",
          border: `3px solid ${player.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          fontWeight: 700,
          fontFamily: "Cinzel, serif",
          color: "var(--vertigo-purple-soft)",
          flexShrink: 0,
        }}>
          {player.display_name?.charAt(0).toUpperCase() ?? "?"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", letterSpacing: "2px", textTransform: "uppercase" }}>
            {player.is_captain && "★ CAPITÁN · "}{player.country ?? "—"}
            {player.clan && ` · ${player.clan}`}
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            {player.display_name}
          </h1>
          {player.team_registration?.team_account && (
            <Link
              href={`/equipos/${teamRegId}`}
              style={{
                fontSize: "14px",
                color: "var(--vertigo-purple-soft)",
                textDecoration: "none",
                marginTop: "4px",
                display: "inline-block",
              }}
            >
              {player.team_registration.team_account.name}
            </Link>
          )}
        </div>
      </section>

      {/* Stats */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "12px",
        marginBottom: "32px",
      }}>
        <StatCard label="ELO máx RM 1v1" value={player.max_rating_rm_1v1?.toString() ?? "—"} color="var(--vertigo-purple-soft)" />
        <StatCard label="ELO actual" value={player.rating_rm_1v1_current?.toString() ?? "—"} color="var(--vertigo-text)" />
        <StatCard label="Victorias" value={wins.toString()} color="var(--vertigo-success)" />
        <StatCard label="Derrotas" value={losses.toString()} color="var(--vertigo-danger)" />
      </section>

      {/* Links externos */}
      {player.aoe2_profile_id && (
        <section style={{ marginBottom: "32px" }}>
          <a
            href={`https://www.aoe2companion.com/players/${player.aoe2_profile_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              background: "var(--vertigo-purple)",
              color: "#fff",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Ver perfil en AoE2 Companion ↗
          </a>
        </section>
      )}

      {/* Historial de partidas */}
      <section>
        <h2 style={{
          fontSize: "14px",
          color: "var(--vertigo-purple-soft)",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          Historial de partidas ({matches.length})
        </h2>
        {matches.length === 0 ? (
          <div style={{
            padding: "20px",
            background: "var(--vertigo-panel)",
            borderRadius: "10px",
            border: "1px solid var(--vertigo-line)",
            color: "var(--vertigo-muted)",
            fontSize: "13px",
            textAlign: "center",
          }}>
            Sin partidas jugadas todavía.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {matches.map((m) => {
              const won = m.winner_team_id === teamRegId;
              const teamScore = m.team_a_id === teamRegId ? m.score_a : m.score_b;
              const rivalScore = m.team_a_id === teamRegId ? m.score_b : m.score_a;
              return (
                <Link
                  key={m.id}
                  href={`/partido/${m.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "var(--vertigo-panel)",
                    borderRadius: "10px",
                    border: `1px solid ${won ? "rgba(34,197,94,0.3)" : "var(--vertigo-line)"}`,
                    textDecoration: "none",
                    color: "var(--vertigo-text)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "10px",
                      fontWeight: 700,
                      background: won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: won ? "var(--vertigo-success)" : "var(--vertigo-danger)",
                    }}>
                      {won ? "GANÓ" : "PERDIÓ"}
                    </span>
                    <div>
                      <div style={{ fontSize: "13px" }}>
                        {m.round?.name} vs {m.rival?.team_account?.name ?? "—"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                        {m.scheduled_at_start
                          ? new Date(m.scheduled_at_start).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
                          : "Sin fecha"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: won ? "var(--vertigo-success)" : "var(--vertigo-muted)" }}>
                    {teamScore}-{rivalScore}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "16px",
      background: "var(--vertigo-panel)",
      borderRadius: "10px",
      border: "1px solid var(--vertigo-line)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", letterSpacing: "1px", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700, color, marginTop: "4px", fontFamily: "Inter, sans-serif" }}>
        {value}
      </div>
    </div>
  );
}
