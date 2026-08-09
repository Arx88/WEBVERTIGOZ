import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { openMatch, finishMatch, cancelMatch, forfeitMatch, markInvocarProUsed } from "@/server/actions/match";
import { commitDraw, publishDraw, revealDraw } from "@/server/actions/draw";
import Link from "next/link";
import { Shield, LogOut, ArrowLeft, Play, Flag, X, Trophy, Eye, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

// Wrappers para form actions: Next.js espera (formData) => void | Promise<void>
// Los server actions devuelven objetos con ok/error, estos wrappers los descartan.
async function wrap<T>(fn: () => Promise<T>, _formData: FormData): Promise<void> {
  await fn();
}
async function openMatchAction(matchId: string, fd: FormData) { await wrap(() => openMatch(matchId), fd); }
async function finishMatchAction(matchId: string, winnerTeamId: string, scoreA: number, scoreB: number, fd: FormData) {
  await wrap(() => finishMatch(matchId, winnerTeamId, scoreA, scoreB), fd);
}
async function cancelMatchAction(matchId: string, reason: string, fd: FormData) {
  await wrap(() => cancelMatch(matchId, reason), fd);
}
async function forfeitMatchAction(matchId: string, losingTeamId: string, fd: FormData) {
  await wrap(() => forfeitMatch(matchId, losingTeamId), fd);
}
async function markInvocarProAction(matchId: string, teamId: string, fd: FormData) {
  await wrap(() => markInvocarProUsed(matchId, teamId), fd);
}
async function commitDrawAction(spinType: "match" | "seeding" | "regirar", options: { matchId?: string; bracketId?: string }, fd: FormData) {
  await wrap(() => commitDraw(spinType, options), fd);
}
async function publishDrawAction(drawId: string, results: any, fd: FormData) {
  await wrap(() => publishDraw(drawId, results), fd);
}
async function revealDrawAction(drawId: string, fd: FormData) {
  await wrap(() => revealDraw(drawId), fd);
}

async function getMatchData(matchId: string) {
  const supabase = (await getSupabaseServer()) as any;

  // Match + round + bracket info
  const { data: match } = (await supabase
    .from("match")
    .select(`
      id, status, slot_index, scheduled_at_start, scheduled_at_end, jornada_label,
      team_a_id, team_b_id, winner_team_id, score_a, score_b, format,
      ready_a_at, ready_b_at, ready_lineup_a_at, ready_lineup_b_at,
      finished_at, stream_caster_id, stream_embed_enabled,
      round:round_id (id, name, index, bracket:bracket_id (id, tournament_edition_id))
    `)
    .eq("id", matchId)
    .single()) as { data: any };

  if (!match) return null;

  // Teams info
  const teamIds = [match.team_a_id, match.team_b_id].filter(Boolean);
  let teams: any[] = [];
  if (teamIds.length > 0) {
    const { data: teamsData } = (await supabase
      .from("team_registration")
      .select(`
        id, seed, elo_freeze_snapshot,
        team_account:team_account_id (id, name, tagline, emblem_id)
      `)
      .in("id", teamIds)) as { data: any[] };
    teams = teamsData ?? [];
  }

  // Players de cada team
  for (const team of teams) {
    const { data: players } = (await supabase
      .from("player_registration")
      .select("id, display_name, is_captain, max_rating_rm_1v1, aoe2_profile_id")
      .eq("team_registration_id", team.id)
      .order("is_captain", { ascending: false })) as { data: any[] };
    (team as any).players = players ?? [];
  }

  // Match games
  const { data: games } = (await supabase
    .from("match_game")
    .select(`
      id, game_number, status, game_mode, antimeta_mode, player_mode, map,
      civs_a, civs_b, lineup_a, lineup_b, winner_team_id, started_at, finished_at,
      draw_id
    `)
    .eq("match_id", matchId)
    .order("game_number", { ascending: true })) as { data: any[] };

  // Draw info (si hay)
  const drawIds = (games ?? []).map((g: any) => g.draw_id).filter(Boolean);
  let draws: any[] = [];
  if (drawIds.length > 0) {
    const { data: drawsData } = (await supabase
      .from("roulette_draw")
      .select("id, status, commit_hash, revealed_seed, public_inputs, result, committed_at, revealed_at, published_at")
      .in("id", drawIds)) as { data: any[] };
    draws = drawsData ?? [];
  }

  // Comodin usage en este match
  const { data: comodinUsages } = (await supabase
    .from("comodin_usage")
    .select("id, comodin_type, comodin_inventory_id, executed_at")
    .eq("match_id", matchId)) as { data: any[] };

  // Traer inventarios de comodines de cada team
  for (const team of teams) {
    const { data: inv } = (await supabase
      .from("comodin_inventory")
      .select("id, reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
      .eq("team_registration_id", team.id)
      .single()) as { data: any };
    (team as any).comodinInventory = inv;
  }

  return { match, teams, games: games ?? [], draws, comodinUsages: comodinUsages ?? [] };
}

export default async function AdminPartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: matchId } = await params;

  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account")
    .select("id, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) {
    redirect("/mi-equipo");
  }

  const data = await getMatchData(matchId);
  if (!data) {
    return (
      <div>
        <span className="vertigo-kicker">ERROR</span>
        <h1 className="vertigo-title">Partido no encontrado</h1>
        <p>El match {matchId} no existe.</p>
        <Link href="/admin/bracket" className="vertigo-btn">Volver al bracket</Link>
      </div>
    );
  }

  const { match, teams, games, draws, comodinUsages } = data;
  const teamA = teams.find((t) => t.id === match.team_a_id);
  const teamB = teams.find((t) => t.id === match.team_b_id);
  const currentGame = games.find((g: any) => g.status !== "finished") ?? games[games.length - 1];
  const currentDraw = currentGame?.draw_id
    ? draws.find((d) => d.id === currentGame.draw_id)
    : null;

  // Status helpers
  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
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
  const statusInfo = STATUS_LABELS[match.status] ?? { label: match.status, color: "#6b7280" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <Link href="/admin/bracket" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--vertigo-muted)", fontSize: "13px", marginBottom: "8px" }}>
            <ArrowLeft size={14} /> Bracket
          </Link>
          <span className="vertigo-kicker">{match.round?.name ?? "Match"}</span>
          <h1 className="vertigo-title" style={{ fontSize: "32px" }}>Partido</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
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
          }}>
            {statusInfo.label}
          </span>
        </div>
      </div>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      {/* Teams */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "16px", marginBottom: "32px", alignItems: "center" }}>
        <TeamCard team={teamA} score={match.score_a} isWinner={match.winner_team_id === match.team_a_id} />
        <div style={{ textAlign: "center", color: "var(--vertigo-muted)", fontSize: "12px", letterSpacing: "2px" }}>VS</div>
        <TeamCard team={teamB} score={match.score_b} isWinner={match.winner_team_id === match.team_b_id} />
      </div>

      {/* Scheduling info */}
      <section style={{ marginBottom: "32px" }}>
        <h2 className="vertigo-subtitle">Programación</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <InfoBox label="Inicio" value={match.scheduled_at_start ? new Date(match.scheduled_at_start).toLocaleString("es-AR") : "—"} />
          <InfoBox label="Fin" value={match.scheduled_at_end ? new Date(match.scheduled_at_end).toLocaleString("es-AR") : "—"} />
          <InfoBox label="Jornada" value={match.jornada_label ?? "—"} />
          <InfoBox label="Formato" value={match.format ?? "—"} />
          <InfoBox label="Caster" value={match.stream_caster_id ? "Asignado" : "Sin asignar"} />
        </div>
      </section>

      {/* Acciones según estado */}
      <section style={{ marginBottom: "32px" }}>
        <h2 className="vertigo-subtitle">Acciones</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {/* ABRIR LLAVE */}
          {match.status === "scheduled" && (
            <form action={openMatchAction.bind(null, matchId)}>
              <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-purple)", color: "#fff" }}>
                <Play size={14} style={{ display: "inline", marginRight: "6px" }} />
                Abrir llave
              </button>
            </form>
          )}

          {/* TIRAR RULETA (commit + publish) */}
          {(match.status === "open" || match.status === "drawing") && (
            <>
              <form action={commitDrawAction.bind(null, "match", { matchId })}>
                <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-purple)", color: "#fff" }}>
                  <Sparkles size={14} style={{ display: "inline", marginRight: "6px" }} />
                  {currentDraw ? "Re-sorteo (commit)" : "Tirar ruleta (commit)"}
                </button>
              </form>
              {currentDraw && currentDraw.status === "committed" && (
                <form action={publishDrawAction.bind(null, currentDraw.id, {})}>
                  <button type="submit" className="vertigo-btn">
                    Publicar resultado
                  </button>
                </form>
              )}
              {currentDraw && currentDraw.status === "published" && !currentDraw.revealed_seed && (
                <form action={revealDrawAction.bind(null, currentDraw.id)}>
                  <button type="submit" className="vertigo-btn vertigo-btn-ghost">
                    <Eye size={14} style={{ display: "inline", marginRight: "6px" }} />
                    Revelar seed
                  </button>
                </form>
              )}
              {currentDraw && (
                <Link href={`/sorteos/${currentDraw.id}/verificar`} className="vertigo-btn vertigo-btn-ghost">
                  Verificar sorteo
                </Link>
              )}
            </>
          )}

          {/* FINALIZAR */}
          {(match.status === "in_progress" || match.status === "lineup" || match.status === "comodin_window") && (
            <>
              {teamA && (
                <form action={finishMatchAction.bind(null, matchId, teamA.id, match.score_a + 1, match.score_b)}>
                  <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-success)", color: "#fff" }}>
                    <Trophy size={14} style={{ display: "inline", marginRight: "6px" }} />
                    Ganó {teamA.team_account?.name}
                  </button>
                </form>
              )}
              {teamB && (
                <form action={finishMatchAction.bind(null, matchId, teamB.id, match.score_a, match.score_b + 1)}>
                  <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-success)", color: "#fff" }}>
                    <Trophy size={14} style={{ display: "inline", marginRight: "6px" }} />
                    Ganó {teamB.team_account?.name}
                  </button>
                </form>
              )}
            </>
          )}

          {/* INVOCAR PRO (cualquier estado activo) */}
          {match.status !== "finished" && match.status !== "cancelled" && match.status !== "forfeit" && (
            <>
              {teamA?.comodinInventory?.invocar_pro_available > 0 && (
                <form action={markInvocarProAction.bind(null, matchId, teamA.id)}>
                  <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ borderColor: "var(--vertigo-danger)" }}>
                    <Sparkles size={14} style={{ display: "inline", marginRight: "6px" }} />
                    INVOCAR PRO ({teamA.team_account?.name})
                  </button>
                </form>
              )}
              {teamB?.comodinInventory?.invocar_pro_available > 0 && (
                <form action={markInvocarProAction.bind(null, matchId, teamB.id)}>
                  <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ borderColor: "var(--vertigo-danger)" }}>
                    <Sparkles size={14} style={{ display: "inline", marginRight: "6px" }} />
                    INVOCAR PRO ({teamB.team_account?.name})
                  </button>
                </form>
              )}
            </>
          )}

          {/* W.O. */}
          {match.status !== "finished" && match.status !== "cancelled" && match.status !== "forfeit" && (
            <>
              {teamA && (
                <form action={forfeitMatchAction.bind(null, matchId, teamA.id)}>
                  <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ borderColor: "var(--vertigo-danger)", color: "var(--vertigo-danger)" }}>
                    <Flag size={14} style={{ display: "inline", marginRight: "6px" }} />
                    W.O. {teamA.team_account?.name}
                  </button>
                </form>
              )}
              {teamB && (
                <form action={forfeitMatchAction.bind(null, matchId, teamB.id)}>
                  <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ borderColor: "var(--vertigo-danger)", color: "var(--vertigo-danger)" }}>
                    <Flag size={14} style={{ display: "inline", marginRight: "6px" }} />
                    W.O. {teamB.team_account?.name}
                  </button>
                </form>
              )}
            </>
          )}

          {/* CANCELAR */}
          {match.status !== "finished" && match.status !== "cancelled" && (
            <form action={cancelMatchAction.bind(null, matchId, "admin_cancel")}>
              <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ borderColor: "var(--vertigo-muted)" }}>
                <X size={14} style={{ display: "inline", marginRight: "6px" }} />
                Cancelar match
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Sorteo actual (si hay) */}
      {currentGame && (currentGame.game_mode || currentGame.map) && (
        <section style={{ marginBottom: "32px" }}>
          <h2 className="vertigo-subtitle">Resultado del sorteo (Game #{currentGame.game_number})</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
            <InfoBox label="Modo" value={currentGame.game_mode ?? "—"} />
            <InfoBox label="Antimeta" value={currentGame.antimeta_mode ?? "—"} />
            <InfoBox label="Formato" value={currentGame.player_mode ?? "—"} />
            <InfoBox label="Mapa" value={currentGame.map ?? "—"} />
            <InfoBox label="Civs A" value={Array.isArray(currentGame.civs_a) ? currentGame.civs_a.join(", ") : "—"} />
            <InfoBox label="Civs B" value={Array.isArray(currentGame.civs_b) ? currentGame.civs_b.join(", ") : "—"} />
          </div>
          {currentDraw && (
            <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--vertigo-muted)" }}>
              Sorteo: <code>{currentDraw.id.slice(0, 8)}</code> · Status: <strong>{currentDraw.status}</strong> · Commit: <code>{currentDraw.commit_hash?.slice(0, 16)}...</code>
              {" · "}
              <Link href={`/sorteos/${currentDraw.id}/verificar`} style={{ color: "var(--vertigo-purple-soft)" }}>Verificar</Link>
            </p>
          )}
        </section>
      )}

      {/* Lineups */}
      {games.length > 0 && (
        <section style={{ marginBottom: "32px" }}>
          <h2 className="vertigo-subtitle">Lineups declarados</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <LineupCard
              team={teamA}
              lineup={currentGame?.lineup_a}
              readyAt={match.ready_lineup_a_at}
            />
            <LineupCard
              team={teamB}
              lineup={currentGame?.lineup_b}
              readyAt={match.ready_lineup_b_at}
            />
          </div>
        </section>
      )}

      {/* Comodines usados en este match */}
      {comodinUsages.length > 0 && (
        <section style={{ marginBottom: "32px" }}>
          <h2 className="vertigo-subtitle">Comodines usados ({comodinUsages.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {comodinUsages.map((usage: any) => {
              const team = teams.find((t) => t.comodinInventory?.id === usage.comodin_inventory_id);
              return (
                <div key={usage.id} style={{ padding: "8px 12px", background: "var(--vertigo-panel)", borderRadius: "8px", fontSize: "13px" }}>
                  <strong style={{ color: "var(--vertigo-purple-soft)" }}>{usage.comodin_type}</strong>
                  {" — "}
                  {team?.team_account?.name ?? "Equipo"}
                  {" · "}
                  <span style={{ color: "var(--vertigo-muted)" }}>{new Date(usage.executed_at).toLocaleString("es-AR")}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer con logout */}
      <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid var(--vertigo-line)" }}>
        <form action={logoutAction} style={{ display: "inline" }}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost">
            <LogOut size={14} style={{ display: "inline", marginRight: "6px" }} />
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTES
// ============================================================

function TeamCard({ team, score, isWinner }: { team: any; score: number; isWinner: boolean }) {
  if (!team) {
    return (
      <div style={{ padding: "20px", background: "var(--vertigo-panel)", borderRadius: "12px", textAlign: "center", opacity: 0.4 }}>
        <div style={{ fontSize: "24px", color: "var(--vertigo-muted)" }}>—</div>
        <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", marginTop: "4px" }}>Por definir</div>
      </div>
    );
  }

  return (
    <div style={{
      padding: "20px",
      background: isWinner ? "linear-gradient(180deg, rgba(34,197,94,0.1), rgba(34,197,94,0.02))" : "var(--vertigo-panel)",
      borderRadius: "12px",
      border: `1px solid ${isWinner ? "var(--vertigo-success)" : "var(--vertigo-line)"}`,
    }}>
      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", letterSpacing: "1px" }}>SEED #{team.seed ?? "—"}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--vertigo-text)", marginTop: "4px" }}>
        {team.team_account?.name ?? "Sin nombre"}
      </div>
      {team.team_account?.tagline && (
        <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", fontStyle: "italic", marginTop: "2px" }}>
          "{team.team_account.tagline}"
        </div>
      )}
      <div style={{ fontSize: "24px", fontWeight: 700, color: isWinner ? "var(--vertigo-success)" : "var(--vertigo-text)", marginTop: "8px" }}>
        {score}
      </div>
      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginTop: "8px" }}>
        ELO: {team.elo_freeze_snapshot ?? "—"}
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px 14px", background: "var(--vertigo-panel)", borderRadius: "8px", border: "1px solid var(--vertigo-line)" }}>
      <div style={{ fontSize: "10px", color: "var(--vertigo-muted)", letterSpacing: "1px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "13px", color: "var(--vertigo-text)", marginTop: "4px", fontFamily: "Inter, sans-serif" }}>{value}</div>
    </div>
  );
}

function LineupCard({ team, lineup, readyAt }: { team: any; lineup: any; readyAt: string | null }) {
  const playerIds: string[] = Array.isArray(lineup) ? lineup : [];
  const players = team?.players ?? [];
  const lineupPlayers = players.filter((p: any) => playerIds.includes(p.id));

  return (
    <div style={{ padding: "14px", background: "var(--vertigo-panel)", borderRadius: "8px", border: "1px solid var(--vertigo-line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--vertigo-text)" }}>
          {team?.team_account?.name ?? "—"}
        </div>
        {readyAt && (
          <span style={{ fontSize: "10px", color: "var(--vertigo-success)", padding: "2px 8px", background: "rgba(34,197,94,0.1)", borderRadius: "999px" }}>
            ✓ Listo
          </span>
        )}
      </div>
      {lineupPlayers.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {lineupPlayers.map((p: any) => (
            <div key={p.id} style={{ fontSize: "12px", color: "var(--vertigo-text)" }}>
              {p.is_captain && "★ "}{p.display_name}
              <span style={{ color: "var(--vertigo-muted)", marginLeft: "8px" }}>ELO {p.max_rating_rm_1v1 ?? "—"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", fontStyle: "italic" }}>
          {readyAt ? "Lineup declarado" : "Pendiente de declaración"}
        </div>
      )}
    </div>
  );
}
