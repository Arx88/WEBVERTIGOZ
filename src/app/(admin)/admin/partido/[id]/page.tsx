import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  startDrawFormAction,
  rerollDrawPhaseFormAction,
  reportGameResultFormAction,
  markForfeitFormAction,
  executeComodinFormAction,
  revokeComodinFormAction,
} from "@/server/actions/match-day";
import {
  advanceToLineupAction,
  closeComodinWindowAction,
} from "@/server/actions/match-day";
import { scheduleMatchFormAction } from "@/server/actions/tournament";
import { enforceMatchIfDue } from "@/server/match-enforcement";
import {
  ChevronLeft, Clock, Shield, Trophy, Shuffle, Layers,
  Users, Sparkles, AlertTriangle, Play, CheckCircle2, Dices, ArrowRight, Swords, X,
  CalendarPlus, Save,
} from "lucide-react";
import ForfeitForm from "./forfeit-form";
import VertigoDateTime from "@/components/admin/vertigo-date-time";
import ReadyDeadlineTimer from "@/components/shared/ready-deadline-timer";
import { civName } from "@/lib/constants/civs";
import { fmt } from "@/lib/format";
import LocalTime from "@/components/shared/local-time";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { cls: string; dot: string; label: string }> = {
  scheduled: { cls: "vertigo-badge-purple", dot: "var(--vertigo-purple-soft)", label: "Programado" },
  open: { cls: "vertigo-badge-purple", dot: "var(--vertigo-purple-soft)", label: "Abierto" },
  drawing: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Sorteando" },
  lineup: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Lineup" },
  comodin_window: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Comodines" },
  in_progress: { cls: "vertigo-badge-danger", dot: "var(--vertigo-danger)", label: "En juego" },
  finished: { cls: "vertigo-badge-success", dot: "var(--vertigo-success)", label: "Finalizado" },
  disputed: { cls: "vertigo-badge-danger", dot: "var(--vertigo-danger)", label: "Disputa" },
  forfeit: { cls: "vertigo-badge-purple", dot: "var(--vertigo-faint)", label: "W.O." },
  cancelled: { cls: "vertigo-badge-purple", dot: "var(--vertigo-faint)", label: "Cancelado" },
};

const COMODIN_LABEL: Record<string, string> = {
  reroll: "Reroll",
  anular: "Anular",
  elegir_rival: "Elegir rival",
  invocar_pro: "Invocar pro",
};

export default async function AdminPartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { id } = await params;

  // W.O. automático lazy: si la tolerancia ya venció, se aplica antes de
  // cargar los datos así la página refleja el resultado real.
  try {
    await enforceMatchIfDue(id);
  } catch {
    // best-effort: el cron lo cubre si esto falla
  }

  const { data: match } = (await supabase
    .from("match")
    .select(`
      id, slot_index, status, format, score_a, score_b,
      scheduled_at_start, scheduled_at_end, jornada_label,
      ready_a_at, ready_b_at, ready_lineup_a_at, ready_lineup_b_at,
      winner_team_id, finished_at, anular_used_by_team_id, elegir_rival_used_by_team_id,
      round:round_id (id, index, name, bracket:bracket_id (tournament_edition_id)),
      team_a:team_a_id (id, seed, team_account:team_account_id (name, tagline, emblem_id, emblem:emblem_id (image_url)),
        players:player_registration (id, display_name, is_captain, max_rating_rm_1v1)),
      team_b:team_b_id (id, seed, team_account:team_account_id (name, tagline, emblem_id, emblem:emblem_id (image_url)),
        players:player_registration (id, display_name, is_captain, max_rating_rm_1v1)),
      games:match_game (id, game_number, status, game_mode, antimeta_mode, player_mode, map,
        lineup_a, lineup_b, civs_a, civs_b, civ_assignment_a, civ_assignment_b, winner_team_id, started_at, finished_at,
        draw:draw_id (commit_hash, revealed_seed, status)
      ),
      comodin_usages:comodin_usage (id, comodin_type, status, target_phase, target_player_id, target_player:target_player_id (display_name), notes, requested_at, executed_at)
    `)
    .eq("id", id)
    .single()) as { data: any };

  if (!match) notFound();

  const meta = STATUS_META[match.status] ?? STATUS_META.scheduled;
  const teamA = match.team_a;
  const teamB = match.team_b;
  const winnerA = match.winner_team_id && teamA?.id === match.winner_team_id;
  const winnerB = match.winner_team_id && teamB?.id === match.winner_team_id;
  const games = match.games ?? [];
  const comodinUsages = match.comodin_usages ?? [];
  const isFinished = match.status === "finished";
  const isScheduled = match.status === "scheduled";

  // Próxima partida a sortear (el admin la dispara desde acá).
  //  - P1 cuando no hay sorteo todavía (scheduled/open/drawing de la P1).
  //  - P2/P3 cuando el BO3 quedó 1-1 y la siguiente partida sigue "pending".
  const nextDrawingGame = games.find((g: any) => g.status === "pending" && g.game_number > 1) ?? null;
  const firstGame = games.find((g: any) => g.game_number === 1) ?? null;
  const hasDate = !!match.scheduled_at_start;
  const canStartFirstDraw =
    (isScheduled || match.status === "open") &&
    hasDate &&
    !!match.ready_a_at && !!match.ready_b_at &&
    (!firstGame || firstGame.status === "pending");
  const canStartNextGameDraw = match.status === "in_progress" && !!nextDrawingGame;
  const drawBlockReason = !hasDate
    ? "Primero asignale fecha y hora a la llave"
    : !match.ready_a_at || !match.ready_b_at
    ? "Ambos equipos deben confirmar READY primero"
    : "Decidir resultado en server y reproducir la ruleta en vivo";

  return (
    <div className="vertigo-fade-in">
      <Link href="/admin/jornadas" className="vertigo-btn vertigo-btn-ghost mb-4">
        <ChevronLeft style={{ width: 14, height: 14 }} />
        Volver a jornadas
      </Link>

      <span className="vertigo-kicker">{match.round?.name ?? "PARTIDO"}</span>
      <h1 className="vertigo-title">Partido</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      {/* Status badge grande */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <span className={`vertigo-badge ${meta.cls}`} style={{ padding: "8px 16px", fontSize: 12 }}>
          <span className="vertigo-status-dot" style={{ background: meta.dot, width: 8, height: 8 }} />
          {meta.label}
        </span>
        {match.format && (
          <span className="vertigo-badge vertigo-badge-purple" style={{ padding: "8px 16px", fontSize: 12 }}>
            {match.format}
          </span>
        )}
        {match.jornada_label && (
          <span className="vertigo-badge vertigo-badge-purple" style={{ padding: "8px 16px", fontSize: 12 }}>
            {match.jornada_label}
          </span>
        )}
        {match.scheduled_at_start && (
          <span className="text-xs text-[var(--vertigo-muted)] flex items-center gap-1">
            <Clock style={{ width: 12, height: 12 }} />
            <LocalTime value={match.scheduled_at_start} variant="dateTime" />
          </span>
        )}
        {isScheduled && !hasDate && (
          <span className="vertigo-badge vertigo-badge-warning" style={{ padding: "8px 16px", fontSize: 12 }}>
            <AlertTriangle style={{ width: 13, height: 13 }} />
            SIN FECHA
          </span>
        )}
      </div>

      {/* ═══ SIN FECHA: aviso prominente + programación inline ═══
          Sin horario no existe ventana de READY ni W.O. automático:
          programar la llave es el paso 1, y se puede hacer desde acá.
          Identidad dorada de "pendiente" (el rojo es para W.O.). */}
      {isScheduled && !hasDate && (
        <section className="mb-8">
          <div className="vertigo-nodate" style={{ padding: "24px 26px" }}>
            <div className="flex items-start gap-4 mb-5">
              <div className="vertigo-nodate-medallion" style={{ width: 46, height: 46 }}>
                <CalendarPlus style={{ width: 21, height: 21 }} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2.2px", color: "var(--vertigo-gold)", opacity: 0.85 }}>
                  ACCIÓN REQUERIDA · PASO 1
                </div>
                <div
                  className="font-cinzel"
                  style={{ fontSize: 17, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#e9d18a", marginTop: 3 }}
                >
                  Esta llave no tiene fecha ni hora
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--vertigo-muted)", margin: "8px 0 0", maxWidth: 640 }}>
                  Los capitanes no pueden confirmar READY y el sorteo está bloqueado hasta que
                  la llave tenga horario. Asignalo acá: el READY se habilita 15 min antes
                  y a los 15 min del horario el equipo ausente pierde por W.O.
                </p>
              </div>
            </div>
            <form
              action={scheduleMatchFormAction}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end pt-5"
              style={{ borderTop: "1px solid rgba(212,175,55,0.18)" }}
            >
              <input type="hidden" name="match_id" value={match.id} />
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Inicio</label>
                <VertigoDateTime name="scheduled_at_start" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Jornada</label>
                <input type="text" name="jornada_label" defaultValue={match.jornada_label ?? ""} placeholder="Jornada 1"
                  className="bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-input-border)] rounded-md px-3 py-2 text-[13px] text-[var(--vertigo-text)] w-32" />
              </div>
              <button type="submit" className="vertigo-btn vertigo-btn-primary" style={{ padding: "12px 22px", fontSize: 11 }}>
                <Save style={{ width: 13, height: 13 }} /> Programar llave
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ═══ W.O. DOBLE SIN GANADOR: la llave cerró y nadie avanza ═══
          Ningún equipo confirmó READY → forfeit sin ganador. No existe
          disputa que resolver: la decisión se toma acá. Dos caminos:
          A) asignar ganador (el rival avanza en el bracket) o
          B) reprogramar la llave (vuelve a scheduled, READY desde cero).
          El rojo es el color reservado para W.O. */}
      {match.status === "forfeit" && !match.winner_team_id && (
        <section className="mb-8">
          <div className="vertigo-wo" style={{ padding: "24px 26px" }}>
            <div className="flex items-start gap-4 mb-5">
              <div className="vertigo-wo-medallion" style={{ width: 46, height: 46 }}>
                <AlertTriangle style={{ width: 21, height: 21 }} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2.2px", color: "var(--vertigo-danger)", opacity: 0.9 }}>
                  ACCIÓN REQUERIDA · W.O. SIN GANADOR
                </div>
                <div
                  className="font-cinzel"
                  style={{ fontSize: 17, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--vertigo-danger)", marginTop: 3 }}
                >
                  Ningún equipo confirmó READY
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--vertigo-muted)", margin: "8px 0 0", maxWidth: 660 }}>
                  La llave cerró por W.O. doble y quedó SIN ganador: así no avanza en el bracket.
                  No hay disputa que abrir — decidís acá. Asigná un ganador (el equipo que pierde
                  queda eliminado y el rival avanza) o reprogramá la llave para que se vuelva a
                  jugar con una nueva ventana de READY.
                </p>
              </div>
            </div>
            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5"
              style={{ borderTop: "1px solid rgba(251,113,133,0.18)" }}
            >
              <div className="flex flex-col gap-3">
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", color: "var(--vertigo-faint)" }}>
                  OPCIÓN A · ASIGNAR GANADOR
                </div>
                <ForfeitForm
                  matchId={match.id}
                  action={markForfeitFormAction}
                  teamAId={teamA?.id}
                  teamBId={teamB?.id}
                  teamAName={teamA?.team_account?.name}
                  teamBName={teamB?.team_account?.name}
                  requireWinner
                  buttonLabel="Asignar ganador"
                />
                <p className="text-[11px] text-[var(--vertigo-faint)] leading-snug">
                  Elegí qué equipo pierde; el rival gana la llave y avanza a la siguiente ronda.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", color: "var(--vertigo-faint)" }}>
                  OPCIÓN B · REPROGRAMAR LA LLAVE
                </div>
                <form action={scheduleMatchFormAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="match_id" value={match.id} />
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Nuevo inicio</label>
                    <VertigoDateTime name="scheduled_at_start" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Jornada</label>
                    <input type="text" name="jornada_label" defaultValue={match.jornada_label ?? ""} placeholder="Jornada 1"
                      className="bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-input-border)] rounded-md px-3 py-2 text-[13px] text-[var(--vertigo-text)] w-32" />
                  </div>
                  <button type="submit" className="vertigo-btn vertigo-btn-primary" style={{ padding: "12px 22px", fontSize: 11 }}>
                    <Save style={{ width: 13, height: 13 }} /> Reprogramar llave
                  </button>
                </form>
                <p className="text-[11px] text-[var(--vertigo-faint)] leading-snug">
                  La llave vuelve a PROGRAMADA con el nuevo horario: ambos equipos deben
                  confirmar READY de nuevo y nadie queda eliminado.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Team cards */}
      <section className="mb-8">
        <div className="vertigo-subtitle">Equipos</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TeamCard
            label="Equipo A"
            team={teamA}
            isWinner={winnerA}
            score={match.score_a}
            ready={match.ready_a_at}
            readyLineup={match.ready_lineup_a_at}
          />
          <TeamCard
            label="Equipo B"
            team={teamB}
            isWinner={winnerB}
            score={match.score_b}
            ready={match.ready_b_at}
            readyLineup={match.ready_lineup_b_at}
          />
        </div>
      </section>

      {/* ═══ CENTRO DE OPERACIONES — acciones reales sobre la llave ═══ */}
      <section className="mb-8">
        <div className="vertigo-subtitle">Centro de operaciones</div>
        <div className="vertigo-card premium">
          <div className="vertigo-action-bar" style={{ alignItems: "stretch" }}>
            {/* INICIAR SORTEO P1 — habilitado con fecha + ambos ready (scheduled u open) */}
            {(isScheduled || match.status === "open") && (
              <div className="flex flex-col gap-2">
                <form action={startDrawFormAction}>
                  <input type="hidden" name="match_id" value={match.id} />
                  <input type="hidden" name="game_number" value="1" />
                  <button
                    type="submit"
                    className="vertigo-btn vertigo-btn-primary"
                    disabled={!canStartFirstDraw}
                    title={drawBlockReason}
                  >
                    <Dices style={{ width: 14, height: 14 }} />
                    Iniciar sorteo (Partida 1)
                  </button>
                </form>
                <p className="text-[11px] text-[var(--vertigo-faint)] max-w-xs leading-snug">
                  {!hasDate
                    ? "⚠ La llave no tiene fecha: programala arriba para habilitar el READY y el sorteo."
                    : match.ready_a_at && match.ready_b_at
                    ? "Ambos equipos confirmaron. El sorteo decide en server y se reproduce en vivo (admin, capitanes y overlay ven lo mismo)."
                    : "Esperando READY #1 de ambos equipos para habilitar el sorteo."}
                </p>
              </div>
            )}

            {/* SORTEAR PARTIDA 2/3 — BO3 salió 1-1 y la siguiente partida espera */}
            {canStartNextGameDraw && nextDrawingGame && (
              <div className="flex flex-col gap-2">
                <form action={startDrawFormAction}>
                  <input type="hidden" name="match_id" value={match.id} />
                  <input type="hidden" name="game_number" value={String(nextDrawingGame.game_number)} />
                  <button type="submit" className="vertigo-btn vertigo-btn-primary">
                    <Dices style={{ width: 14, height: 14 }} />
                    Sortear partida {nextDrawingGame.game_number} (decisiva)
                  </button>
                </form>
                <p className="text-[11px] text-[var(--vertigo-faint)] max-w-xs leading-snug">
                  Serie 1-1: la ruleta gira de nuevo (sin fase LLAVE) para la partida decisiva.
                </p>
              </div>
            )}

            {/* El W.O. doble sin ganador NO es una disputa: se resuelve con la
                tarjeta de arriba (asignar ganador o reprogramar). */}
            {!isFinished && !isScheduled && match.status !== "disputed" &&
              !(match.status === "forfeit" && !match.winner_team_id) && (
              <Link href="/admin/disputas" className="vertigo-btn vertigo-btn-danger">
                <AlertTriangle style={{ width: 14, height: 14 }} />
                Ver disputas
              </Link>
            )}
            {match.status === "disputed" && (
              <Link href="/admin/disputas" className="vertigo-btn vertigo-btn-danger">
                <Shield style={{ width: 14, height: 14 }} />
                Resolver disputa
              </Link>
            )}
          </div>
          {match.status === "drawing" && (
            <div className="mt-4 pt-4 border-t border-[var(--vertigo-line-soft)]">
              <p className="text-sm text-[var(--vertigo-muted)]">
                ◆ Sorteo en curso. La ruleta está reproduciéndose en la página pública del partido, en el overlay OBS
                y en las pantallas de ambos capitanes (sincronizado por Realtime).
              </p>
            </div>
          )}
          {match.status === "open" && (
            <div className="mt-4 pt-4 border-t border-[var(--vertigo-line-soft)]">
              <p className="text-sm text-[var(--vertigo-success)]">
                ✓ Ambos equipos confirmaron READY. La llave está HABILITADA para el sorteo.
              </p>
            </div>
          )}
          {/* Timer de la ventana de READY: cuenta regresiva visible para el admin */}
          {isScheduled && hasDate && (
            <div className="mt-4 pt-4 border-t border-[var(--vertigo-line-soft)] grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadyDeadlineTimer scheduledAtStart={match.scheduled_at_start} status={match.status} variant="block" />
              <div className="text-[11px] text-[var(--vertigo-faint)] leading-relaxed self-center">
                El READY se habilita 15 min antes del horario. Si a los 15 min del horario un
                equipo no confirmó, pierde por W.O. automáticamente (check al abrir la página
                + cron diario de respaldo). Si ninguno confirma, la llave cierra sin ganador y decidís vos.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Resultado del sorteo */}
      {games.length > 0 && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Resultado del sorteo</div>
          <div className="flex flex-col gap-4">
            {games.map((g: any) => (
              <div key={g.id} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="flex items-center gap-3">
                    <span className="vertigo-badge vertigo-badge-purple">Partida {g.game_number}</span>
                    <span className={`vertigo-badge ${STATUS_META[g.status]?.cls ?? "vertigo-badge-purple"}`}>
                      {STATUS_META[g.status]?.label ?? g.status}
                    </span>
                  </div>
                  {g.draw?.commit_hash && (
                    <span className="font-mono text-[11px] text-[var(--vertigo-faint)]">
                      {g.draw.commit_hash.slice(0, 16)}…
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Modo</div>
                    <div className="vertigo-info-card-value text-sm">{g.game_mode ?? "—"}</div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Antimeta</div>
                    <div className="vertigo-info-card-value text-sm">{g.antimeta_mode ?? "—"}</div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Player mode</div>
                    <div className="vertigo-info-card-value text-sm">{g.player_mode ?? "—"}</div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Mapa</div>
                    <div className="vertigo-info-card-value text-sm">{g.map ?? "—"}</div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Draw status</div>
                    <div className="vertigo-info-card-value text-sm">{g.draw?.status ?? "—"}</div>
                  </div>
                </div>

                {/* Re-girar una fase (solo si el match está en drawing y es admin) */}
                {match.status === "drawing" && g.draw && (
                  <div className="mt-4 pt-4 border-t border-[var(--vertigo-line-soft)]">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--vertigo-faint)] mb-3">Re-girar una fase del sorteo (admin / comodín Re-girar)</div>
                    <div className="flex flex-wrap gap-2">
                      {(["MODO","ANTIMETA","FORMATO","MAPA","LLAVE","CIVS"] as const).map((phase) => (
                        <form key={phase} action={rerollDrawPhaseFormAction}>
                          <input type="hidden" name="match_id" value={match.id} />
                          <input type="hidden" name="game_number" value={g.game_number} />
                          <input type="hidden" name="phase" value={phase} />
                          <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }}>
                            <Shuffle style={{ width: 12, height: 12 }} /> {phase}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                )}

                {(g.civs_a?.length > 0 || g.civs_b?.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-[var(--vertigo-line-soft)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-2">Civs Equipo A</div>
                      <div className="flex flex-wrap gap-1">
                        {(g.civs_a ?? []).map((c: string, i: number) => (
                          <span key={i} className="vertigo-badge vertigo-badge-purple">{c}</span>
                        ))}
                        {(!g.civs_a || g.civs_a.length === 0) && <span className="text-xs text-[var(--vertigo-faint)]">—</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-2">Civs Equipo B</div>
                      <div className="flex flex-wrap gap-1">
                        {(g.civs_b ?? []).map((c: string, i: number) => (
                          <span key={i} className="vertigo-badge vertigo-badge-purple">{c}</span>
                        ))}
                        {(!g.civs_b || g.civs_b.length === 0) && <span className="text-xs text-[var(--vertigo-faint)]">—</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lineups */}
      {games.length > 0 && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Lineups</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Equipo A", team: teamA, games, lineups: (g: any) => g.lineup_a, assignment: (g: any) => g.civ_assignment_a },
              { label: "Equipo B", team: teamB, games, lineups: (g: any) => g.lineup_b, assignment: (g: any) => g.civ_assignment_b },
            ].map(({ label, team, games, lineups, assignment }) => (
              <div key={label} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="font-cinzel text-base text-[var(--vertigo-text)]">
                    {team?.team_account?.name ?? label}
                  </div>
                  <Users style={{ width: 16, height: 16, color: "var(--vertigo-purple-soft)" }} />
                </div>
                {games.map((g: any) => {
                  const lineup = lineups(g);
                  const civAssign = (assignment(g) ?? {}) as Record<string, string>;
                  return (
                    <div key={g.id} className="mb-3 last:mb-0">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-1">
                        Partida {g.game_number}
                      </div>
                      {Array.isArray(lineup) && lineup.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {lineup.map((pid: string, i: number) => {
                            const player = team?.players?.find((p: any) => p.id === pid);
                            const civ = civAssign[pid];
                            return (
                              <div key={i} className="flex items-center gap-2 flex-wrap">
                                <span className="vertigo-badge vertigo-badge-purple">
                                  {player?.display_name ?? pid.slice(0, 8)}
                                </span>
                                {civ ? (
                                  <span className="vertigo-badge vertigo-badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`/civs/${civ}.webp`} alt="" style={{ width: 14, height: 14, objectFit: "contain" }} />
                                    {civName(civ)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[var(--vertigo-faint)]">civ sin asignar</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--vertigo-faint)]">Sin lineup declarado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comodines usados */}
      <section className="mb-8">
        <div className="vertigo-subtitle">Comodines usados</div>
        {comodinUsages.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Sparkles className="mx-auto mb-3" style={{ width: 36, height: 36, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">Sin comodines</div>
              <p className="vertigo-empty-desc">Ninguno de los dos equipos usó comodines en esta llave todavía.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {comodinUsages.map((c: any) => (
              <div key={c.id} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="flex items-center gap-2">
                    <Sparkles style={{ width: 14, height: 14, color: "var(--vertigo-purple-soft)" }} />
                    <span className="font-cinzel text-sm text-[var(--vertigo-text)]">
                      {COMODIN_LABEL[c.comodin_type] ?? c.comodin_type}
                    </span>
                  </div>
                  <span className={`vertigo-badge ${c.status === "executed" ? "vertigo-badge-success" : c.status === "pending" ? "vertigo-badge-warning" : "vertigo-badge-purple"}`}>{c.status}</span>
                </div>
                {c.target_phase && (
                  <div className="text-xs text-[var(--vertigo-muted)] mb-2">
                    Fase objetivo: <span className="text-[var(--vertigo-purple-pale)]">{c.target_phase}</span>
                  </div>
                )}
                {c.target_player?.display_name && (
                  <div className="text-xs text-[var(--vertigo-muted)] mb-2">
                    Jugador objetivo: <span className="text-[var(--vertigo-purple-pale)]">{c.target_player.display_name}</span>
                  </div>
                )}
                {c.notes && (
                  <div className="text-xs text-[var(--vertigo-muted)]">{c.notes}</div>
                )}
                <div className="text-[11px] text-[var(--vertigo-faint)] mt-2">
                  Pedido: {fmt.dateTime(c.requested_at)}
                  {c.executed_at && ` · Ejecutado: ${fmt.dateTime(c.executed_at)}`}
                </div>
                {/* El admin ejecuta/revoca los pedidos pendientes (control de stream) */}
                {c.status === "pending" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--vertigo-line-soft)]">
                    <form action={executeComodinFormAction}>
                      <input type="hidden" name="comodin_usage_id" value={c.id} />
                      <button type="submit" className="vertigo-btn vertigo-btn-primary" style={{ padding: "8px 16px", fontSize: 11 }}>
                        <CheckCircle2 style={{ width: 12, height: 12 }} />
                        Ejecutar en vivo
                      </button>
                    </form>
                    <form action={revokeComodinFormAction}>
                      <input type="hidden" name="comodin_usage_id" value={c.id} />
                      <button type="submit" className="vertigo-btn vertigo-btn-danger" style={{ padding: "8px 16px", fontSize: 11 }}>
                        <X style={{ width: 12, height: 12 }} />
                        Revocar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ TRANSICIONES DE FASE (la llave avanza paso a paso) ═══ */}
      {!isFinished && match.status !== "disputed" && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Operar la llave</div>
          <div className="vertigo-card">
            <div className="flex flex-wrap gap-3">
              {/* drawing → lineup */}
              {match.status === "drawing" && (
                <form action={async () => { "use server"; const { advanceToLineupAction } = await import("@/server/actions/match-day"); await advanceToLineupAction(match.id); }}>
                  <button type="submit" className="vertigo-btn vertigo-btn-primary">
                    <ArrowRight style={{ width: 14, height: 14 }} /> Publicar sorteo → Lineup
                  </button>
                </form>
              )}
              {/* lineup → comodin_window */}
              {match.status === "lineup" && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-[var(--vertigo-muted)]">
                    Esperando que ambos equipos declaren lineup y confirmen READY #2. Cuando lo hagan, la ventana de comodines se abre sola.
                  </div>
                </div>
              )}
              {/* comodin_window → in_progress */}
              {match.status === "comodin_window" && (
                <form action={async () => { "use server"; const { closeComodinWindowAction } = await import("@/server/actions/match-day"); await closeComodinWindowAction(match.id); }}>
                  <button type="submit" className="vertigo-btn vertigo-btn-success">
                    <Play style={{ width: 14, height: 14 }} /> Cerrar comodines → ¡Se juega!
                  </button>
                </form>
              )}
              {/* in_progress: mensaje */}
              {match.status === "in_progress" && (
                <div className="flex items-center gap-2 text-sm text-[var(--vertigo-success)]">
                  <span className="vertigo-status-dot" style={{ background: "var(--vertigo-success)" }} />
                  Partida en juego. Cargá el resultado abajo cuando termine.
                </div>
              )}
              {/* Forfeit — siempre disponible si no terminó */}
              <ForfeitForm
                matchId={match.id}
                action={markForfeitFormAction}
                teamAId={teamA?.id}
                teamBId={teamB?.id}
                teamAName={teamA?.team_account?.name}
                teamBName={teamB?.team_account?.name}
              />
            </div>
          </div>
        </section>
      )}

      {/* ═══ CARGAR RESULTADO POR PARTIDA (BO3) ═══ */}
      {match.status === "in_progress" && games.length > 0 && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Cargar resultado</div>
          <div className="flex flex-col gap-4">
            {games.filter((g: any) => g.status !== "finished").map((g: any) => (
              <div key={g.id} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="flex items-center gap-3">
                    <span className="vertigo-badge vertigo-badge-purple">Partida {g.game_number}</span>
                    {g.llave_format && <span className="vertigo-badge vertigo-badge-purple">{g.llave_format}</span>}
                    <span className="text-xs text-[var(--vertigo-faint)]">{g.map ?? "Mapa por sorteo"} · {g.player_mode ?? "?"}</span>
                  </div>
                </div>
                <form action={reportGameResultFormAction} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <input type="hidden" name="match_game_id" value={g.id} />
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Ganador</label>
                    <select name="winner_team_id" required className="bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-input-border)] rounded-md px-3 py-2.5 text-[13px] text-[var(--vertigo-text)]">
                      <option value="">— Elegí ganador —</option>
                      <option value={match.team_a?.id}>{match.team_a?.team_account?.name ?? "Equipo A"}</option>
                      <option value={match.team_b?.id}>{match.team_b?.team_account?.name ?? "Equipo B"}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Replay URL (opcional)</label>
                    <input type="url" name="replay_url" placeholder="https://…" className="bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-input-border)] rounded-md px-3 py-2.5 text-[13px] text-[var(--vertigo-text)]" />
                  </div>
                  <button type="submit" className="vertigo-btn vertigo-btn-success">
                    <CheckCircle2 style={{ width: 14, height: 14 }} /> Reportar
                  </button>
                </form>
              </div>
            ))}
            {games.filter((g: any) => g.status === "finished").length > 0 && (
              <p className="text-xs text-[var(--vertigo-faint)] italic">
                Partidas ya finalizadas: {games.filter((g: any) => g.status === "finished").length}. {match.format === "BO3" ? "Si está 1-1, sorteá la partida decisiva." : ""}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Disputas */}
      {match.status === "disputed" && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Disputa activa</div>
          <div className="vertigo-card">
            <div className="flex items-start gap-3">
              <AlertTriangle className="flex-none text-[var(--vertigo-danger)] mt-0.5" style={{ width: 18, height: 18 }} />
              <div>
                <div className="vertigo-card-title">Partido en disputa</div>
                <p className="text-sm text-[var(--vertigo-muted)] mt-2">
                  Este partido tiene una disputa abierta. Revisala desde el panel de disputas para ver evidencias y resolver.
                </p>
                <Link href="/admin/disputas" className="vertigo-btn vertigo-btn-danger mt-3">
                  <Shield style={{ width: 14, height: 14 }} />
                  Ir a disputas
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Resultado final */}
      {isFinished && (
        <section>
          <div className="vertigo-subtitle">Resultado final</div>
          <div className="vertigo-card">
            <div className="flex items-center gap-4">
              <Trophy style={{ width: 28, height: 28, color: "var(--vertigo-purple-pale)" }} strokeWidth={1.5} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">Ganador</div>
                <div className="font-cinzel text-xl text-[var(--vertigo-text)]">
                  {winnerA ? teamA?.team_account?.name : winnerB ? teamB?.team_account?.name : "—"}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">Score</div>
                <div className="font-cinzel text-2xl text-[var(--vertigo-purple-pale)]">
                  {match.score_a} - {match.score_b}
                </div>
              </div>
            </div>
            {match.finished_at && (
              <div className="text-xs text-[var(--vertigo-faint)] mt-3 pt-3 border-t border-[var(--vertigo-line-soft)]">
                Finalizado: {fmt.dateTime(match.finished_at)}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function TeamCard({
  label,
  team,
  isWinner,
  score,
  ready,
  readyLineup,
}: {
  label: string;
  team: any;
  isWinner: boolean;
  score: number;
  ready: string | null;
  readyLineup: string | null;
}) {
  const name = team?.team_account?.name ?? "—";
  const tagline = team?.team_account?.tagline;
  const emblemUrl = team?.team_account?.emblem?.image_url ?? null;
  const players = team?.players ?? [];

  return (
    <div className={`vertigo-card ${isWinner ? "border-[var(--vertigo-purple)]" : ""}`}>
      <div className="vertigo-card-header">
        <div className="flex items-center gap-3 min-w-0">
          {emblemUrl ? (
            <div className="flex-none overflow-hidden rounded-full border border-[rgba(212,175,55,0.5)] bg-[var(--vertigo-input-bg)]" style={{ width: 42, height: 42 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={emblemUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-full border border-[var(--vertigo-purple)] text-[var(--vertigo-purple-soft)] flex-none"
              style={{ width: 40, height: 40 }}
            >
              <Shield style={{ width: 18, height: 18 }} strokeWidth={1.25} />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">{label}</div>
            <div className="font-cinzel text-base font-semibold text-[var(--vertigo-text)] truncate">
              {name}
            </div>
            {tagline && <div className="text-xs italic text-[var(--vertigo-muted)] truncate">&ldquo;{tagline}&rdquo;</div>}
          </div>
        </div>
        <div className="text-right flex-none">
          <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">Score</div>
          <div
            className="font-cinzel text-3xl font-bold"
            style={{ color: isWinner ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)" }}
          >
            {score}
          </div>
        </div>
      </div>

      {isWinner && (
        <div className="mb-3">
          <span className="vertigo-badge vertigo-badge-success">
            <Trophy style={{ width: 11, height: 11 }} />
            Ganador
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="vertigo-info-card">
          <div className="vertigo-info-card-label">READY #1</div>
          <div className="vertigo-info-card-value text-xs">
            {fmt.time(ready)}
          </div>
        </div>
        <div className="vertigo-info-card">
          <div className="vertigo-info-card-label">READY #2</div>
          <div className="vertigo-info-card-value text-xs">
            {fmt.time(readyLineup)}
          </div>
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-2">Jugadores</div>
      <div className="flex flex-wrap gap-1">
        {players.map((p: any) => (
          <span key={p.id} className="vertigo-badge vertigo-badge-purple">
            {p.is_captain ? "★ " : ""}{p.display_name}
            {p.max_rating_rm_1v1 !== null && (
              <span className="text-[var(--vertigo-faint)] ml-1">{p.max_rating_rm_1v1}</span>
            )}
          </span>
        ))}
        {players.length === 0 && <span className="text-xs text-[var(--vertigo-faint)]">Sin jugadores</span>}
      </div>
    </div>
  );
}
