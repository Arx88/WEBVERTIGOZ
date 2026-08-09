import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const supabase = (await getSupabaseServer()) as any;

  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name")
    .eq("slug", "vertigo-2026-1")
    .single()) as { data: any };

  let standings: any[] = [];

  if (edition) {
    const { data: bracket } = (await supabase
      .from("bracket")
      .select("id")
      .eq("tournament_edition_id", edition.id)
      .single()) as { data: any };

    if (bracket) {
      const { data: rounds } = (await supabase
        .from("round")
        .select("id")
        .eq("bracket_id", bracket.id)) as { data: any[] };

      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map((r) => r.id);

        // Todos los matches
        const { data: allMatches } = (await supabase
          .from("match")
          .select("id, status, team_a_id, team_b_id, winner_team_id, score_a, score_b")
          .in("round_id", roundIds)
          .in("status", ["finished", "forfeit"])) as { data: any[] };

        // Todos los teams
        const { data: regs } = (await supabase
          .from("team_registration")
          .select(`
            id, seed, elo_freeze_snapshot,
            team_account:team_account_id (id, name)
          `)
          .eq("tournament_edition_id", edition.id)
          .eq("status", "approved")) as { data: any[] };

        // Calcular W-L por team
        const teamStats: Record<string, { wins: number; losses: number; roundsWon: number; roundsLost: number }> = {};
        regs?.forEach((r) => {
          teamStats[r.id] = { wins: 0, losses: 0, roundsWon: 0, roundsLost: 0 };
        });

        (allMatches ?? []).forEach((m) => {
          if (!m.winner_team_id) return;
          const loserId = m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
          if (teamStats[m.winner_team_id]) {
            teamStats[m.winner_team_id].wins++;
            teamStats[m.winner_team_id].roundsWon += m.winner_team_id === m.team_a_id ? m.score_a : m.score_b;
            teamStats[m.winner_team_id].roundsLost += m.winner_team_id === m.team_a_id ? m.score_b : m.score_a;
          }
          if (loserId && teamStats[loserId]) {
            teamStats[loserId].losses++;
          }
        });

        // Combinar con team data y ordenar por wins (desc), then roundsWon (desc)
        standings = (regs ?? [])
          .map((r) => ({
            ...r,
            ...teamStats[r.id],
          }))
          .sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
            return (a.seed ?? 999) - (b.seed ?? 999);
          });
      }
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <div style={{ marginBottom: "32px" }}>
        <Link href="/" style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver al inicio
        </Link>
        <div style={{ marginTop: "12px" }}>
          <span style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", letterSpacing: "2px", textTransform: "uppercase" }}>
            {edition?.name ?? "VÉRTIGO Cup"}
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            Tabla de posiciones
          </h1>
        </div>
      </div>

      {standings.length === 0 ? (
        <div style={{
          padding: "40px",
          background: "var(--vertigo-panel)",
          borderRadius: "12px",
          textAlign: "center",
          border: "1px solid var(--vertigo-line)",
        }}>
          <h2 style={{ fontSize: "20px", color: "var(--vertigo-text)", marginBottom: "8px" }}>
            Sin datos todavía
          </h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            La tabla se generará cuando se jueguen los partidos.
          </p>
        </div>
      ) : (
        <div style={{
          background: "var(--vertigo-panel)",
          borderRadius: "12px",
          border: "1px solid var(--vertigo-line)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr 60px 60px 60px 80px",
            gap: "8px",
            padding: "12px 16px",
            background: "var(--vertigo-bg)",
            borderBottom: "1px solid var(--vertigo-line)",
            fontSize: "10px",
            color: "var(--vertigo-muted)",
            letterSpacing: "1px",
            textTransform: "uppercase",
            fontWeight: 700,
          }}>
            <div>#</div>
            <div>Equipo</div>
            <div style={{ textAlign: "center" }}>W</div>
            <div style={{ textAlign: "center" }}>L</div>
            <div style={{ textAlign: "center" }}>ELO</div>
            <div style={{ textAlign: "center" }}>Seed</div>
          </div>
          {/* Rows */}
          {standings.map((s, idx) => (
            <Link
              key={s.id}
              href={`/equipos/${s.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 60px 60px 60px 80px",
                gap: "8px",
                padding: "12px 16px",
                borderBottom: "1px solid var(--vertigo-line)",
                textDecoration: "none",
                color: "var(--vertigo-text)",
                background: idx === 0 ? "rgba(124,58,237,0.05)" : "transparent",
              }}
            >
              <div style={{
                fontSize: "14px",
                fontWeight: 700,
                color: idx === 0 ? "var(--vertigo-purple-soft)" : "var(--vertigo-muted)",
              }}>
                {idx === 0 && <Trophy size={12} style={{ display: "inline", marginRight: "4px" }} />}
                {idx + 1}
              </div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>
                {s.team_account?.name ?? "—"}
              </div>
              <div style={{ textAlign: "center", fontSize: "14px", fontWeight: 700, color: "var(--vertigo-success)" }}>
                {s.wins}
              </div>
              <div style={{ textAlign: "center", fontSize: "14px", fontWeight: 700, color: "var(--vertigo-danger)" }}>
                {s.losses}
              </div>
              <div style={{ textAlign: "center", fontSize: "13px", color: "var(--vertigo-muted)" }}>
                {s.elo_freeze_snapshot ?? "—"}
              </div>
              <div style={{ textAlign: "center", fontSize: "13px", color: "var(--vertigo-muted)" }}>
                #{s.seed ?? "—"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
