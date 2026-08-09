import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ResultadosPage() {
  const supabase = (await getSupabaseServer()) as any;

  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name")
    .eq("slug", "vertigo-2026-1")
    .single()) as { data: any };

  let matches: any[] = [];
  let teamsMap: Record<string, any> = {};

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
        const { data: matchesData } = (await supabase
          .from("match")
          .select(`
            id, status, slot_index, scheduled_at_start, score_a, score_b,
            winner_team_id, format, team_a_id, team_b_id,
            round:round_id (id, name, index)
          `)
          .in("round_id", roundIds)
          .in("status", ["finished", "forfeit"])
          .order("finished_at", { ascending: false })) as { data: any[] };

        matches = matchesData ?? [];

        // Cargar teams
        const teamIds = new Set<string>();
        matches.forEach((m) => {
          if (m.team_a_id) teamIds.add(m.team_a_id);
          if (m.team_b_id) teamIds.add(m.team_b_id);
        });

        if (teamIds.size > 0) {
          const { data: teamsData } = (await supabase
            .from("team_registration")
            .select(`id, team_account:team_account_id (id, name)`)
            .in("id", Array.from(teamIds))) as { data: any[] };
          teamsData?.forEach((t) => { teamsMap[t.id] = t; });
        }
      }
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <div style={{ marginBottom: "32px" }}>
        <Link href="/" style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver al inicio
        </Link>
        <div style={{ marginTop: "12px" }}>
          <span style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", letterSpacing: "2px", textTransform: "uppercase" }}>
            {edition?.name ?? "VÉRTIGO Cup"}
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            Resultados
          </h1>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px", marginTop: "8px" }}>
            {matches.length} partidas finalizadas
          </p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div style={{
          padding: "40px",
          background: "var(--vertigo-panel)",
          borderRadius: "12px",
          textAlign: "center",
          border: "1px solid var(--vertigo-line)",
        }}>
          <h2 style={{ fontSize: "20px", color: "var(--vertigo-text)", marginBottom: "8px" }}>
            Sin resultados todavía
          </h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            Los resultados aparecerán cuando se jueguen los partidos.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {matches.map((m) => {
            const teamA = m.team_a_id ? teamsMap[m.team_a_id] : null;
            const teamB = m.team_b_id ? teamsMap[m.team_b_id] : null;
            const winnerA = m.winner_team_id === m.team_a_id;
            const winnerB = m.winner_team_id === m.team_b_id;
            return (
              <Link
                key={m.id}
                href={`/partido/${m.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  gap: "16px",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "10px",
                  border: "1px solid var(--vertigo-line)",
                  textDecoration: "none",
                }}
              >
                {/* Team A */}
                <div style={{ textAlign: "right", fontSize: "14px", fontWeight: winnerA ? 700 : 400, color: winnerA ? "var(--vertigo-success)" : "var(--vertigo-text)" }}>
                  {winnerA && <Trophy size={12} style={{ display: "inline", marginRight: "4px" }} />}
                  {teamA?.team_account?.name ?? "—"}
                </div>
                {/* Score */}
                <div style={{
                  textAlign: "center",
                  fontSize: "18px",
                  fontWeight: 700,
                  fontFamily: "Inter, sans-serif",
                  color: "var(--vertigo-text)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {m.score_a}-{m.score_b}
                </div>
                {/* Team B */}
                <div style={{ textAlign: "left", fontSize: "14px", fontWeight: winnerB ? 700 : 400, color: winnerB ? "var(--vertigo-success)" : "var(--vertigo-text)" }}>
                  {teamB?.team_account?.name ?? "—"}
                  {winnerB && <Trophy size={12} style={{ display: "inline", marginLeft: "4px" }} />}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
