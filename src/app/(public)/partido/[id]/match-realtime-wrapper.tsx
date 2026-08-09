"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { civName } from "@/lib/constants/civs";
import { Clock, Trophy, Eye, Sparkles, Users, Calendar } from "lucide-react";

interface MatchRealtimeWrapperProps {
  matchId: string;
  initialMatch: any;
  initialTeamA: any;
  initialTeamB: any;
  initialGames: any[];
  initialDrawsMap: Record<string, any>;
  caster: any;
  comodinUsages: any[];
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  scheduled: { label: "PROGRAMADO", color: "#4A6FA5" },
  open: { label: "ABIERTO", color: "#22c55e" },
  drawing: { label: "SORTEANDO", color: "#fbbf24" },
  lineup: { label: "LINEUP", color: "#a78bfa" },
  comodin_window: { label: "COMODINES", color: "#fbbf24" },
  in_progress: { label: "EN JUEGO", color: "#ef4444" },
  finished: { label: "FINALIZADO", color: "#22c55e" },
  disputed: { label: "DISPUTA", color: "#ef4444" },
  forfeit: { label: "W.O.", color: "#6b7280" },
  cancelled: { label: "CANCELADO", color: "#6b7280" },
};

export default function MatchRealtimeWrapper({
  matchId,
  initialMatch,
  initialTeamA,
  initialTeamB,
  initialGames,
  initialDrawsMap,
  caster,
  comodinUsages,
}: MatchRealtimeWrapperProps) {
  const [match, setMatch] = useState(initialMatch);
  const [games, setGames] = useState(initialGames);
  const [drawsMap, setDrawsMap] = useState(initialDrawsMap);
  const [now, setNow] = useState(Date.now());

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Realtime
  useEffect(() => {
    let channel: any = null;

    async function setupRealtime() {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) return;

        const supabase = createClient(supabaseUrl, supabaseKey);

        channel = supabase
          .channel(`match-${matchId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "match",
              filter: `id=eq.${matchId}`,
            },
            (payload: any) => {
              if (payload.eventType === "UPDATE") {
                setMatch(payload.new);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "match_game",
              filter: `match_id=eq.${matchId}`,
            },
            (payload: any) => {
              if (payload.eventType === "INSERT") {
                setGames((prev) => [...prev, payload.new]);
              } else if (payload.eventType === "UPDATE") {
                setGames((prev) =>
                  prev.map((g) => (g.id === payload.new.id ? payload.new : g))
                );
                // Si el game tiene draw_id nuevo, fetchear el draw
                if (payload.new.draw_id && !drawsMap[payload.new.draw_id]) {
                  fetchDraw(payload.new.draw_id);
                }
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("[MatchRealtime] error:", e);
      }
    }

    setupRealtime();

    return () => {
      if (channel) channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function fetchDraw(drawId: string) {
    try {
      const res = await fetch(`/api/draw/info?id=${drawId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setDrawsMap((prev) => ({ ...prev, [drawId]: data.draw }));
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const statusInfo = STATUS_INFO[match.status] ?? { label: match.status, color: "#6b7280" };
  const teamA = initialTeamA;
  const teamB = initialTeamB;
  const currentGame = games.find((g: any) => g.status !== "finished") ?? games[games.length - 1];
  const currentDraw = currentGame?.draw_id ? drawsMap[currentGame.draw_id] : null;
  const drawPublished = currentDraw?.status === "published" || currentDraw?.status === "revealed";
  const drawSpinning = currentDraw?.status === "spinning" || match.status === "drawing";

  // Countdown
  const scheduledTime = match.scheduled_at_start ? new Date(match.scheduled_at_start).getTime() : null;
  const diffMs = scheduledTime ? scheduledTime - now : null;
  const isCountingDown = diffMs !== null && diffMs > 0 && match.status === "scheduled";

  let countdownStr = "";
  if (isCountingDown && diffMs !== null) {
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) countdownStr = `${days}d ${hours}h ${minutes}m`;
    else if (hours > 0) countdownStr = `${hours}h ${minutes}m ${seconds}s`;
    else countdownStr = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }

  const isFinished = match.status === "finished" || match.status === "forfeit";

  return (
    <>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
      }}>
        <div>
          <span style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", letterSpacing: "2px", textTransform: "uppercase" }}>
            {match.round?.name ?? "Partido"}
          </span>
          <h1 style={{ fontSize: "32px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            {teamA?.team_account?.name ?? "Por definir"} <span style={{ color: "var(--vertigo-muted)" }}>vs</span> {teamB?.team_account?.name ?? "Por definir"}
          </h1>
        </div>
        <span style={{
          padding: "6px 14px",
          background: `${statusInfo.color}22`,
          color: statusInfo.color,
          border: `1px solid ${statusInfo.color}`,
          borderRadius: "999px",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "1px",
          textTransform: "uppercase",
          animation: drawSpinning ? "pulse 1.5s ease-in-out infinite" : undefined,
        }}>
          {statusInfo.label}
        </span>
      </div>

      {/* Scoreboard */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: "24px",
        alignItems: "center",
        padding: "32px",
        background: "var(--vertigo-panel)",
        borderRadius: "16px",
        border: `1px solid ${statusInfo.color}44`,
        marginBottom: "24px",
      }}>
        {/* Team A */}
        <TeamDisplay
          team={teamA}
          score={match.score_a}
          isWinner={match.winner_team_id === match.team_a_id}
          align="right"
        />

        {/* Score / VS */}
        <div style={{ textAlign: "center" }}>
          {isFinished ? (
            <div style={{
              fontSize: "48px",
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              color: "var(--vertigo-text)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {match.score_a}<span style={{ color: "var(--vertigo-muted)", margin: "0 8px" }}>-</span>{match.score_b}
            </div>
          ) : isCountingDown ? (
            <div>
              <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", letterSpacing: "2px" }}>EMPIEZA EN</div>
              <div style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--vertigo-purple-soft)",
                fontFamily: "Inter, sans-serif",
                fontVariantNumeric: "tabular-nums",
                marginTop: "4px",
              }}>
                {countdownStr}
              </div>
            </div>
          ) : (
            <div style={{
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--vertigo-muted)",
              fontFamily: "Cinzel, serif",
            }}>
              VS
            </div>
          )}
        </div>

        {/* Team B */}
        <TeamDisplay
          team={teamB}
          score={match.score_b}
          isWinner={match.winner_team_id === match.team_b_id}
          align="left"
        />
      </section>

      {/* Info del partido */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "12px",
        marginBottom: "24px",
      }}>
        <InfoCard
          icon={<Calendar size={14} />}
          label="Inicio"
          value={match.scheduled_at_start
            ? new Date(match.scheduled_at_start).toLocaleString("es-AR", {
                weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })
            : "Por definir"}
        />
        <InfoCard
          icon={<Clock size={14} />}
          label="Fin estimado"
          value={match.scheduled_at_end
            ? new Date(match.scheduled_at_end).toLocaleString("es-AR", {
                weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })
            : "—"}
        />
        <InfoCard
          icon={<Trophy size={14} />}
          label="Ronda"
          value={match.round?.name ?? "—"}
        />
        <InfoCard
          icon={<Sparkles size={14} />}
          label="Formato"
          value={match.format ?? "Por sortear"}
        />
        {match.jornada_label && (
          <InfoCard
            icon={<Calendar size={14} />}
            label="Jornada"
            value={match.jornada_label}
          />
        )}
        {caster && (
          <InfoCard
            icon={<Eye size={14} />}
            label="Caster"
            value={caster.name}
            href={caster.channel_url ?? undefined}
          />
        )}
      </section>

      {/* Resultado del sorteo en curso */}
      {drawSpinning && (
        <section style={{
          padding: "24px",
          background: "rgba(251,191,36,0.08)",
          borderRadius: "12px",
          border: "1px solid var(--vertigo-warning)",
          marginBottom: "24px",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "18px",
            color: "var(--vertigo-warning)",
            fontWeight: 700,
            animation: "pulse 1.5s ease-in-out infinite",
          }}>
            🎰 Sorteo en curso...
          </div>
          <div style={{ fontSize: "13px", color: "var(--vertigo-muted)", marginTop: "8px" }}>
            La ruleta está girando. Los resultados aparecerán automáticamente cuando termine.
          </div>
        </section>
      )}

      {/* Resultado del sorteo publicado */}
      {drawPublished && currentGame && (
        <section style={{
          padding: "24px",
          background: "rgba(124,58,237,0.08)",
          borderRadius: "12px",
          border: "1px solid var(--vertigo-purple)",
          marginBottom: "24px",
        }}>
          <h2 style={{
            fontSize: "14px",
            color: "var(--vertigo-purple-soft)",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <Sparkles size={14} />
            Resultado del sorteo {currentGame.game_number > 1 ? `(Game ${currentGame.game_number})` : ""}
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
          }}>
            <DrawResult label="Modo de juego" value={currentGame.game_mode} />
            <DrawResult label="Antimeta" value={currentGame.antimeta_mode} />
            <DrawResult label="Formato" value={currentGame.player_mode} />
            <DrawResult label="Mapa" value={currentGame.map} />
          </div>

          {/* Civs */}
          {(Array.isArray(currentGame.civs_a) && currentGame.civs_a.length > 0) ||
           (Array.isArray(currentGame.civs_b) && currentGame.civs_b.length > 0) ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid var(--vertigo-line)",
            }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "6px" }}>
                  Civs {teamA?.team_account?.name ?? "A"}:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(Array.isArray(currentGame.civs_a) ? currentGame.civs_a : []).map((c: string) => (
                    <span key={c} style={{
                      padding: "4px 10px",
                      background: "var(--vertigo-bg)",
                      borderRadius: "999px",
                      fontSize: "11px",
                      color: "var(--vertigo-text)",
                      border: "1px solid var(--vertigo-line)",
                    }}>
                      {civName(c)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "6px" }}>
                  Civs {teamB?.team_account?.name ?? "B"}:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(Array.isArray(currentGame.civs_b) ? currentGame.civs_b : []).map((c: string) => (
                    <span key={c} style={{
                      padding: "4px 10px",
                      background: "var(--vertigo-bg)",
                      borderRadius: "999px",
                      fontSize: "11px",
                      color: "var(--vertigo-text)",
                      border: "1px solid var(--vertigo-line)",
                    }}>
                      {civName(c)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Lineups */}
          {((Array.isArray(currentGame.lineup_a) && currentGame.lineup_a.length > 0) ||
            (Array.isArray(currentGame.lineup_b) && currentGame.lineup_b.length > 0)) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid var(--vertigo-line)",
            }}>
              <LineupDisplay
                label={`Lineup ${teamA?.team_account?.name ?? "A"}`}
                lineupIds={currentGame.lineup_a}
                players={teamA?.players ?? []}
              />
              <LineupDisplay
                label={`Lineup ${teamB?.team_account?.name ?? "B"}`}
                lineupIds={currentGame.lineup_b}
                players={teamB?.players ?? []}
              />
            </div>
          )}

          {/* Link verificación */}
          {currentDraw && (
            <div style={{ marginTop: "16px", fontSize: "11px", color: "var(--vertigo-muted)" }}>
              Sorteo: <code>{currentDraw.id?.slice(0, 8)}</code>
              {" · "}
              Commit: <code>{currentDraw.commit_hash?.slice(0, 16)}...</code>
              {" · "}
              <Link href={`/sorteos/${currentDraw.id}/verificar`} style={{ color: "var(--vertigo-purple-soft)" }}>
                <Eye size={10} style={{ display: "inline", marginRight: "2px" }} />
                Verificar criptográficamente
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Comodines usados */}
      {comodinUsages.length > 0 && (
        <section style={{
          padding: "16px",
          background: "var(--vertigo-panel)",
          borderRadius: "10px",
          border: "1px solid var(--vertigo-line)",
          marginBottom: "24px",
        }}>
          <h3 style={{
            fontSize: "12px",
            color: "var(--vertigo-purple-soft)",
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>
            Comodines usados ({comodinUsages.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {comodinUsages.map((u: any) => {
              const teamId = u.comodin_inventory?.team_registration_id;
              const team = teamId === match.team_a_id ? teamA : teamB;
              return (
                <div key={u.id} style={{ fontSize: "12px", color: "var(--vertigo-text)" }}>
                  <strong style={{ color: "var(--vertigo-purple-soft)" }}>{u.comodin_type}</strong>
                  {" — "}
                  {team?.team_account?.name ?? "Equipo"}
                  {" · "}
                  <span style={{ color: "var(--vertigo-muted)" }}>
                    {new Date(u.executed_at).toLocaleString("es-AR")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Historial de games (si BO3) */}
      {games.length > 1 && (
        <section>
          <h2 style={{
            fontSize: "14px",
            color: "var(--vertigo-purple-soft)",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}>
            Games del match (BO3)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {games.map((g: any) => {
              const gameDraw = g.draw_id ? drawsMap[g.draw_id] : null;
              const isCurrent = g.id === currentGame?.id;
              return (
                <div key={g.id} style={{
                  padding: "12px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "8px",
                  border: `1px solid ${isCurrent ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                  opacity: g.status === "pending" ? 0.5 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>
                      Game {g.game_number}
                      {isCurrent && (
                        <span style={{
                          marginLeft: "8px",
                          padding: "2px 6px",
                          background: "var(--vertigo-purple)",
                          color: "#fff",
                          borderRadius: "999px",
                          fontSize: "9px",
                          fontWeight: 700,
                        }}>
                          ACTUAL
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                      {g.status.toUpperCase()}
                    </div>
                  </div>
                  {g.game_mode && (
                    <div style={{ fontSize: "12px", color: "var(--vertigo-muted)" }}>
                      {g.game_mode} · {g.map ?? "—"}
                      {g.winner_team_id && (
                        <span style={{ marginLeft: "8px", color: "var(--vertigo-success)" }}>
                          Ganó {g.winner_team_id === match.team_a_id ? teamA?.team_account?.name : teamB?.team_account?.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
}

function TeamDisplay({ team, score, isWinner, align }: { team: any; score: number; isWinner: boolean; align: "left" | "right" }) {
  if (!team) {
    return (
      <div style={{ textAlign: align }}>
        <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>POR DEFINIR</div>
        <div style={{ fontSize: "20px", color: "var(--vertigo-muted)", marginTop: "4px" }}>—</div>
      </div>
    );
  }
  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>SEED #{team.seed ?? "—"}</div>
      <div style={{
        fontSize: "20px",
        fontWeight: 700,
        marginTop: "4px",
        color: isWinner ? "var(--vertigo-success)" : "var(--vertigo-text)",
        fontFamily: "Cinzel, serif",
      }}>
        {team.team_account?.name}
      </div>
      {team.elo_freeze_snapshot && (
        <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginTop: "4px" }}>
          ELO: {team.elo_freeze_snapshot}
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div style={{
      padding: "12px 14px",
      background: "var(--vertigo-panel)",
      borderRadius: "10px",
      border: "1px solid var(--vertigo-line)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "10px",
        color: "var(--vertigo-muted)",
        letterSpacing: "1px",
        textTransform: "uppercase",
      }}>
        {icon}
        {label}
      </div>
      <div style={{
        fontSize: "13px",
        color: "var(--vertigo-text)",
        marginTop: "4px",
        fontFamily: "Inter, sans-serif",
      }}>
        {value}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        {content}
      </a>
    );
  }
  return content;
}

function DrawResult({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{
      padding: "10px",
      background: "var(--vertigo-bg)",
      borderRadius: "8px",
    }}>
      <div style={{ fontSize: "10px", color: "var(--vertigo-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
        {label}
      </div>
      <div style={{ fontSize: "15px", color: "var(--vertigo-text)", fontWeight: 600, marginTop: "2px" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function LineupDisplay({ label, lineupIds, players }: { label: string; lineupIds: string[]; players: any[] }) {
  const ids: string[] = Array.isArray(lineupIds) ? lineupIds : [];
  const lineupPlayers = players.filter((p) => ids.includes(p.id));

  return (
    <div>
      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "6px" }}>{label}:</div>
      {lineupPlayers.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {lineupPlayers.map((p) => (
            <div key={p.id} style={{ fontSize: "12px", color: "var(--vertigo-text)" }}>
              {p.is_captain && "★ "}{p.display_name}
              <span style={{ color: "var(--vertigo-muted)", marginLeft: "6px" }}>
                ELO {p.max_rating_rm_1v1 ?? "—"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", fontStyle: "italic" }}>
          Sin declarar
        </div>
      )}
    </div>
  );
}
