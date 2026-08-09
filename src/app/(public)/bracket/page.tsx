import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateBracket, BRACKET_SIZE } from "@/lib/bracket/engine";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicBracketPage() {
  const supabase = (await getSupabaseServer()) as any;

  // Buscar edición activa
  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name, status")
    .eq("slug", "vertigo-2026-1")
    .single()) as { data: any };

  let bracket: any = null;
  let rounds: any[] = [];
  let matches: any[] = [];
  let teamRegs: any[] = [];

  if (edition) {
    const { data: bracketData } = (await supabase
      .from("bracket")
      .select("id")
      .eq("tournament_edition_id", edition.id)
      .eq("type", "winner")
      .single()) as { data: any };
    bracket = bracketData;

    if (bracket) {
      const { data: roundsData } = (await supabase
        .from("round")
        .select("id, index, name")
        .eq("bracket_id", bracket.id)
        .order("index", { ascending: true })) as { data: any[] };
      rounds = roundsData ?? [];

      if (rounds.length > 0) {
        const roundIds = rounds.map((r) => r.id);
        const { data: matchesData } = (await supabase
          .from("match")
          .select(`
            id, status, slot_index, team_a_id, team_b_id, winner_team_id,
            score_a, score_b, scheduled_at_start, jornada_label,
            round:round_id (id, name, index)
          `)
          .in("round_id", roundIds)
          .order("slot_index", { ascending: true })) as { data: any[] };
        matches = matchesData ?? [];
      }

      const { data: regsData } = (await supabase
        .from("team_registration")
        .select(`
          id, seed,
          team_account:team_account_id (id, name, tagline, emblem_id)
        `)
        .eq("tournament_edition_id", edition.id)
        .order("seed", { ascending: true })) as { data: any[] };
      teamRegs = regsData ?? [];
    }
  }

  const generatedBracket = generateBracket(BRACKET_SIZE);
  const teamMap = new Map<string, any>();
  teamRegs.forEach((t) => teamMap.set(t.id, t));
  const matchMap = new Map<string, any>();
  matches.forEach((m) => matchMap.set(`${m.round.index}-${m.slot_index}`, m));

  return (
    <main className="min-h-screen px-6 py-12 max-w-7xl mx-auto">
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <Link href="/" style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver al inicio
        </Link>
        <div style={{ marginTop: "12px" }}>
          <span style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", letterSpacing: "2px", textTransform: "uppercase" }}>
            {edition?.name ?? "VÉRTIGO Cup"}
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            Bracket del torneo
          </h1>
        </div>
      </div>

      {!bracket ? (
        <div style={{
          padding: "40px",
          background: "var(--vertigo-panel)",
          borderRadius: "12px",
          textAlign: "center",
          border: "1px solid var(--vertigo-line)",
        }}>
          <h2 style={{ fontSize: "20px", color: "var(--vertigo-text)", marginBottom: "8px" }}>
            Bracket no disponible todavía
          </h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            El bracket se generará cuando se completen las inscripciones y se realice el sorteo inicial.
          </p>
        </div>
      ) : (
        <>
          {/* Bracket visual */}
          <div style={{ overflowX: "auto", paddingBottom: "16px" }}>
            <div style={{ display: "flex", gap: "20px", minWidth: "max-content" }}>
              {generatedBracket.rounds.map((round) => (
                <div key={round.index} style={{ minWidth: "200px" }}>
                  <div style={{
                    fontSize: "11px",
                    color: "var(--vertigo-purple-soft)",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                    paddingBottom: "6px",
                    borderBottom: "1px solid var(--vertigo-line)",
                    fontWeight: 700,
                  }}>
                    {round.name}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {round.matches.map((genMatch) => {
                      const dbMatch = matchMap.get(`${round.index}-${genMatch.slotIndex}`);
                      const teamA = dbMatch?.team_a_id ? teamMap.get(dbMatch.team_a_id) : null;
                      const teamB = dbMatch?.team_b_id ? teamMap.get(dbMatch.team_b_id) : null;
                      const status = dbMatch?.status ?? "pending";

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
                        pending: "#3a3049",
                      };
                      const color = statusColors[status] ?? "#6b7280";

                      return (
                        <Link
                          key={genMatch.tempId}
                          href={dbMatch ? `/partido/${dbMatch.id}` : "#"}
                          style={{
                            display: "block",
                            padding: "10px",
                            background: "var(--vertigo-panel)",
                            borderRadius: "8px",
                            border: `1px solid ${color}55`,
                            textDecoration: "none",
                            cursor: dbMatch ? "pointer" : "default",
                            opacity: dbMatch ? 1 : 0.5,
                            transition: "transform 0.15s, border-color 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "10px", color: "var(--vertigo-muted)" }}>
                              {round.name.charAt(0)}{genMatch.slotIndex + 1}
                            </span>
                            {dbMatch && status !== "pending" && (
                              <span style={{
                                fontSize: "8px",
                                padding: "1px 5px",
                                background: `${color}22`,
                                color: color,
                                borderRadius: "999px",
                                fontWeight: 700,
                                letterSpacing: "0.5px",
                              }}>
                                {status === "in_progress" ? "LIVE" : status === "finished" ? "FIN" : status.toUpperCase().slice(0, 4)}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: "12px",
                            color: teamA ? "var(--vertigo-text)" : "var(--vertigo-muted)",
                            fontWeight: dbMatch?.winner_team_id === dbMatch?.team_a_id ? 700 : 400,
                          }}>
                            {teamA?.team_account?.name ?? (genMatch.seedA ? `Seed ${genMatch.seedA}` : "—")}
                            {dbMatch?.winner_team_id === dbMatch?.team_a_id && (
                              <Trophy size={10} style={{ display: "inline", marginLeft: "4px", color: "var(--vertigo-success)" }} />
                            )}
                            {dbMatch && (dbMatch.score_a > 0 || dbMatch.score_b > 0 || dbMatch.status === "finished") && (
                              <span style={{ float: "right", color: dbMatch.winner_team_id === dbMatch.team_a_id ? "var(--vertigo-success)" : "var(--vertigo-muted)" }}>
                                {dbMatch.score_a}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: "12px",
                            color: teamB ? "var(--vertigo-text)" : "var(--vertigo-muted)",
                            marginTop: "2px",
                            fontWeight: dbMatch?.winner_team_id === dbMatch?.team_b_id ? 700 : 400,
                          }}>
                            {teamB?.team_account?.name ?? (genMatch.seedB ? `Seed ${genMatch.seedB}` : "—")}
                            {dbMatch?.winner_team_id === dbMatch?.team_b_id && (
                              <Trophy size={10} style={{ display: "inline", marginLeft: "4px", color: "var(--vertigo-success)" }} />
                            )}
                            {dbMatch && (dbMatch.score_a > 0 || dbMatch.score_b > 0 || dbMatch.status === "finished") && (
                              <span style={{ float: "right", color: dbMatch.winner_team_id === dbMatch.team_b_id ? "var(--vertigo-success)" : "var(--vertigo-muted)" }}>
                                {dbMatch.score_b}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leyenda */}
          <div style={{
            marginTop: "32px",
            padding: "16px",
            background: "var(--vertigo-panel)",
            borderRadius: "10px",
            border: "1px solid var(--vertigo-line)",
          }}>
            <h3 style={{ fontSize: "12px", color: "var(--vertigo-purple-soft)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              Leyenda
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "12px" }}>
              <LegendItem color="#4A6FA5" label="Programado" />
              <LegendItem color="#22c55e" label="Abierto / Finalizado" />
              <LegendItem color="#fbbf24" label="Sorteando / Comodines" />
              <LegendItem color="#a78bfa" label="Lineup" />
              <LegendItem color="#ef4444" label="En juego" />
              <LegendItem color="#6b7280" label="W.O. / Cancelado" />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{
        width: "10px",
        height: "10px",
        background: color,
        borderRadius: "2px",
      }} />
      <span style={{ color: "var(--vertigo-muted)" }}>{label}</span>
    </div>
  );
}
