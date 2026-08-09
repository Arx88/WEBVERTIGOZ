import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { civName } from "@/lib/constants/civs";
import TeamRealtimeWrapper from "./team-realtime-wrapper";

export const dynamic = "force-dynamic";

async function getTeamProfile(teamRegistrationId: string) {
  const supabase = (await getSupabaseServer()) as any;

  // 1. Team registration + team_account
  const { data: reg } = (await supabase
    .from("team_registration")
    .select(`
      id, seed, status, elo_freeze_snapshot, base_civ_ids, extra_civ_ids,
      team_account:team_account_id (id, name, tagline, emblem_id, owner_id),
      tournament_edition:tournament_edition_id (id, name, elo_cap, elo_tolerance)
    `)
    .eq("id", teamRegistrationId)
    .single()) as { data: any };

  if (!reg) return null;

  // 2. Players
  const { data: players } = (await supabase
    .from("player_registration")
    .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, rating_rm_1v1_current, aoe2_profile_id, is_verified")
    .eq("team_registration_id", reg.id)
    .order("is_captain", { ascending: false })) as { data: any[] };

  // 3. Comodin inventory
  const { data: comodinInv } = (await supabase
    .from("comodin_inventory")
    .select("id, reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
    .eq("team_registration_id", reg.id)
    .single()) as { data: any };

  // 4. Próxima partida (match donde el team es A o B, y no está finished)
  const { data: upcomingMatches } = (await supabase
    .from("match")
    .select(`
      id, status, scheduled_at_start, scheduled_at_end, jornada_label, format,
      score_a, score_b, winner_team_id,
      team_a_id, team_b_id,
      round:round_id (id, name, index)
    `)
    .or(`team_a_id.eq.${reg.id},team_b_id.eq.${reg.id}`)
    .in("status", ["scheduled", "open", "drawing", "lineup", "comodin_window", "in_progress"])
    .order("scheduled_at_start", { ascending: true })
    .limit(1)) as { data: any[] };

  const upcomingMatch = upcomingMatches?.[0] ?? null;

  // 5. Si hay próxima partida, buscar el rival y el sorteo actual
  let rival: any = null;
  let currentGame: any = null;
  let currentDraw: any = null;

  if (upcomingMatch) {
    const rivalId = upcomingMatch.team_a_id === reg.id
      ? upcomingMatch.team_b_id
      : upcomingMatch.team_a_id;

    if (rivalId) {
      const { data: rivalReg } = (await supabase
        .from("team_registration")
        .select(`
          id, seed, elo_freeze_snapshot,
          team_account:team_account_id (id, name, tagline, emblem_id)
        `)
        .eq("id", rivalId)
        .single()) as { data: any };
      rival = rivalReg;
    }

    // Match games
    const { data: games } = (await supabase
      .from("match_game")
      .select(`
        id, game_number, status, game_mode, antimeta_mode, player_mode, map,
        civs_a, civs_b, lineup_a, lineup_b, draw_id
      `)
      .eq("match_id", upcomingMatch.id)
      .order("game_number", { ascending: true })) as { data: any[] };

    currentGame = games?.find((g: any) => g.status !== "finished") ?? games?.[games.length - 1] ?? null;

    if (currentGame?.draw_id) {
      const { data: draw } = (await supabase
        .from("roulette_draw")
        .select("id, status, commit_hash, revealed_seed, public_inputs, result, committed_at, published_at")
        .eq("id", currentGame.draw_id)
        .single()) as { data: any };
      currentDraw = draw;
    }
  }

  // 6. Historial de partidas finalizadas
  const { data: finishedMatches } = (await supabase
    .from("match")
    .select(`
      id, status, scheduled_at_start, score_a, score_b, winner_team_id, format,
      team_a_id, team_b_id,
      round:round_id (id, name, index)
    `)
    .or(`team_a_id.eq.${reg.id},team_b_id.eq.${reg.id}`)
    .in("status", ["finished", "forfeit"])
    .order("scheduled_at_start", { ascending: false })) as { data: any[] };

  // Enriquecer historial con nombres de rivales
  const rivalIds = (finishedMatches ?? []).map((m: any) =>
    m.team_a_id === reg.id ? m.team_b_id : m.team_a_id
  ).filter(Boolean);

  let rivalsMap: Record<string, any> = {};
  if (rivalIds.length > 0) {
    const { data: rivalsData } = (await supabase
      .from("team_registration")
      .select(`
        id,
        team_account:team_account_id (id, name)
      `)
      .in("id", rivalIds)) as { data: any[] };
    rivalsData?.forEach((r) => {
      rivalsMap[r.id] = r;
    });
  }

  return {
    team: reg,
    players: players ?? [],
    comodinInventory: comodinInv,
    upcomingMatch,
    rival,
    currentGame,
    currentDraw,
    finishedMatches: finishedMatches ?? [],
    rivalsMap,
  };
}

export default async function EquipoProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getTeamProfile(id);

  if (!data) {
    notFound();
  }

  const { team, players, comodinInventory, upcomingMatch, rival, currentGame, currentDraw, finishedMatches, rivalsMap } = data;

  // Calcular wins/losses
  const wins = finishedMatches.filter((m: any) => m.winner_team_id === team.id).length;
  const losses = finishedMatches.filter((m: any) => m.winner_team_id !== team.id && m.winner_team_id !== null).length;

  // Detectar si es finalista (para mostrar civs extra)
  const isFinalist = team.tournament_edition && upcomingMatch?.round?.index === 4;

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <Link href="/equipos" style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver a equipos
        </Link>
      </div>

      {/* HEADER DEL EQUIPO */}
      <section style={{
        display: "flex",
        alignItems: "center",
        gap: "24px",
        padding: "24px",
        background: "var(--vertigo-panel)",
        borderRadius: "16px",
        border: "1px solid var(--vertigo-line)",
        marginBottom: "32px",
      }}>
        {/* Escudo */}
        <div style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "var(--vertigo-bg)",
          border: "3px solid var(--vertigo-purple)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "36px",
          fontWeight: 700,
          fontFamily: "Cinzel, serif",
          color: "var(--vertigo-purple-soft)",
          flexShrink: 0,
        }}>
          {team.team_account?.name?.charAt(0).toUpperCase() ?? "?"}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", letterSpacing: "2px", textTransform: "uppercase" }}>
            SEED #{team.seed ?? "—"} · {team.tournament_edition?.name ?? "VÉRTIGO Cup"}
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            {team.team_account?.name}
          </h1>
          {team.team_account?.tagline && (
            <div style={{ fontSize: "14px", color: "var(--vertigo-muted)", fontStyle: "italic", marginTop: "4px" }}>
              "{team.team_account.tagline}"
            </div>
          )}
          <div style={{ display: "flex", gap: "20px", marginTop: "12px", fontSize: "12px" }}>
            <div>
              <span style={{ color: "var(--vertigo-muted)" }}>Capitán: </span>
              <strong style={{ color: "var(--vertigo-text)" }}>
                {players.find((p: any) => p.is_captain)?.display_name ?? "—"}
              </strong>
            </div>
            <div>
              <span style={{ color: "var(--vertigo-muted)" }}>ELO: </span>
              <strong style={{ color: "var(--vertigo-purple-soft)" }}>{team.elo_freeze_snapshot ?? "—"}</strong>
              <span style={{ color: "var(--vertigo-muted)" }}> / {(team.tournament_edition?.elo_cap ?? 3500) + (team.tournament_edition?.elo_tolerance ?? 20)}</span>
            </div>
            <div>
              <span style={{ color: "var(--vertigo-success)" }}>{wins}W</span>
              <span style={{ color: "var(--vertigo-muted)" }}> · </span>
              <span style={{ color: "var(--vertigo-danger)" }}>{losses}L</span>
            </div>
          </div>
        </div>
      </section>

      {/* PRÓXIMA PARTIDA con realtime wrapper */}
      {upcomingMatch ? (
        <TeamRealtimeWrapper
          teamId={team.id}
          matchId={upcomingMatch.id}
          initialMatch={upcomingMatch}
          initialRival={rival}
          initialGame={currentGame}
          initialDraw={currentDraw}
          formatLabel={upcomingMatch.format}
        />
      ) : (
        <section style={{
          padding: "32px",
          background: "var(--vertigo-panel)",
          borderRadius: "12px",
          border: "1px solid var(--vertigo-line)",
          marginBottom: "32px",
          textAlign: "center",
        }}>
          <h2 style={{ fontSize: "18px", color: "var(--vertigo-text)", marginBottom: "8px" }}>
            No hay próxima partida
          </h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            {finishedMatches.length > 0
              ? "El equipo terminó su participación en esta edición."
              : "El bracket aún no se generó o este equipo no tiene matches asignados."}
          </p>
        </section>
      )}

      {/* COMODINES DISPONIBLES */}
      {comodinInventory && (
        <section style={{ marginBottom: "32px" }}>
          <h2 style={{
            fontSize: "14px",
            color: "var(--vertigo-purple-soft)",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}>
            Comodines disponibles
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
          }}>
            <ComodinCard
              label="Re-girar"
              available={comodinInventory.reroll_available}
              total={2}
              color="#4A6FA5"
            />
            <ComodinCard
              label="Anular jugador"
              available={comodinInventory.anular_available}
              total={1}
              color="#7A5A8A"
            />
            <ComodinCard
              label="Elegir rival"
              available={comodinInventory.elegir_rival_available}
              total={1}
              color="#5B8C5A"
            />
            <ComodinCard
              label="INVOCAR PRO"
              available={comodinInventory.invocar_pro_available}
              total={1}
              color="#C44536"
            />
          </div>
        </section>
      )}

      {/* HISTORIAL DEL TORNEO */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{
          fontSize: "14px",
          color: "var(--vertigo-purple-soft)",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          Historial del torneo ({finishedMatches.length})
        </h2>
        {finishedMatches.length === 0 ? (
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
            {finishedMatches.map((m: any) => {
              const rivalId = m.team_a_id === team.id ? m.team_b_id : m.team_a_id;
              const rivalInfo = rivalsMap[rivalId];
              const won = m.winner_team_id === team.id;
              const teamScore = m.team_a_id === team.id ? m.score_a : m.score_b;
              const rivalScore = m.team_a_id === team.id ? m.score_b : m.score_a;

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
                      {won ? "GANASTE" : "PERDISTE"}
                    </span>
                    <div>
                      <div style={{ fontSize: "13px" }}>
                        {m.round?.name} vs {rivalInfo?.team_account?.name ?? "—"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                        {m.scheduled_at_start
                          ? new Date(m.scheduled_at_start).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
                          : "Sin fecha"}
                        {" · "}
                        {m.format ?? "BO3"}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    fontFamily: "Inter, sans-serif",
                    color: won ? "var(--vertigo-success)" : "var(--vertigo-muted)",
                  }}>
                    {teamScore}-{rivalScore}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* JUGADORES */}
      <section>
        <h2 style={{
          fontSize: "14px",
          color: "var(--vertigo-purple-soft)",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          Jugadores
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}>
          {players.map((p: any) => (
            <div
              key={p.id}
              style={{
                padding: "14px",
                background: "var(--vertigo-panel)",
                borderRadius: "10px",
                border: "1px solid var(--vertigo-line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "var(--vertigo-bg)",
                  border: `2px solid ${p.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--vertigo-text)",
                }}>
                  {p.display_name?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--vertigo-text)" }}>
                    {p.is_captain && "★ "}{p.display_name}
                  </div>
                  {p.country && (
                    <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>{p.country}</div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "var(--vertigo-muted)" }}>
                ELO máx: <strong style={{ color: "var(--vertigo-purple-soft)" }}>{p.max_rating_rm_1v1 ?? "—"}</strong>
              </div>
              {p.aoe2_profile_id && (
                <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginTop: "2px" }}>
                  <a
                    href={`https://www.aoe2companion.com/players/${p.aoe2_profile_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--vertigo-purple-soft)", textDecoration: "none" }}
                  >
                    AoE2 Companion ↗
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Civs del equipo (debug info, opcional) */}
      {team.base_civ_ids && Array.isArray(team.base_civ_ids) && team.base_civ_ids.length > 0 && (
        <section style={{ marginTop: "32px" }}>
          <h2 style={{
            fontSize: "14px",
            color: "var(--vertigo-purple-soft)",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}>
            Pool de civs ({team.base_civ_ids.length}{isFinalist ? ` + ${team.extra_civ_ids?.length ?? 0} extra` : ""})
          </h2>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            padding: "16px",
            background: "var(--vertigo-panel)",
            borderRadius: "10px",
            border: "1px solid var(--vertigo-line)",
          }}>
            {team.base_civ_ids.map((civId: string) => (
              <span key={civId} style={{
                padding: "4px 10px",
                background: "var(--vertigo-bg)",
                borderRadius: "999px",
                fontSize: "11px",
                color: "var(--vertigo-text)",
                border: "1px solid var(--vertigo-line)",
              }}>
                {civName(civId)}
              </span>
            ))}
            {isFinalist && team.extra_civ_ids?.map((civId: string) => (
              <span key={civId} style={{
                padding: "4px 10px",
                background: "rgba(124,58,237,0.15)",
                borderRadius: "999px",
                fontSize: "11px",
                color: "var(--vertigo-purple-soft)",
                border: "1px solid var(--vertigo-purple)",
              }}>
                ★ {civName(civId)}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function ComodinCard({ label, available, total, color }: { label: string; available: number; total: number; color: string }) {
  const isAvailable = available > 0;
  return (
    <div style={{
      padding: "14px",
      background: isAvailable ? `${color}15` : "var(--vertigo-panel)",
      borderRadius: "10px",
      border: `1px solid ${isAvailable ? color : "var(--vertigo-line)"}`,
      opacity: isAvailable ? 1 : 0.5,
    }}>
      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", letterSpacing: "1px", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{
        fontSize: "20px",
        fontWeight: 700,
        color: isAvailable ? color : "var(--vertigo-muted)",
        marginTop: "4px",
        fontFamily: "Inter, sans-serif",
      }}>
        {available}/{total}
      </div>
    </div>
  );
}
