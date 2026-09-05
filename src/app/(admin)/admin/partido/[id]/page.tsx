import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  reportGameResultFormAction,
  markForfeitFormAction,
  executeComodinFormAction,
  revokeComodinFormAction,
  advanceToLineupAction,
  closeComodinWindowAction,
} from "@/server/actions/match-day";
import { scheduleMatchFormAction } from "@/server/actions/tournament";
import { extendReadyWindowFormAction } from "@/server/actions/ready";
import { enforceMatchIfDue } from "@/server/match-enforcement";
import { computeReadyPhase } from "@/lib/match-rules";

/** +HH:MM:SS desde ms — para la demora de la ventana de decisión de W.O. */
function fmtOverdue(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
import { syncAoe2IfDue } from "@/lib/aoe2/match-sync";
import { linkAoe2MatchFormAction } from "@/server/actions/aoe2-sync";
import {
  Shield, Trophy, Shuffle, Sparkles, AlertTriangle, Play, CheckCircle2,
  Dices, ArrowRight, X, CalendarPlus, Save, Timer, Plus, ExternalLink,
  Check, Clock, Map as MapIcon,
} from "lucide-react";
import ForfeitForm from "./forfeit-form";
import VertigoDateTime from "@/components/admin/vertigo-date-time";
import ReadyDeadlineTimer from "@/components/shared/ready-deadline-timer";
import MatchLiveRefresher from "@/components/admin/match-live-refresher";
import LobbyNameCard from "@/components/shared/lobby-name-card";
import Aoe2SyncIndicator from "@/components/admin/aoe2-sync-indicator";
import RerollPhaseForm from "@/components/admin/reroll-phase-form";
import { civName } from "@/lib/constants/civs";
import { fmt } from "@/lib/format";
import { lobbyNameForGame } from "@/lib/aoe2/lobby-name";
import LocalTime from "@/components/shared/local-time";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { cls: string; dot: string; label: string }> = {
  scheduled: { cls: "vertigo-badge-purple", dot: "var(--vertigo-purple-soft)", label: "Programado" },
  open: { cls: "vertigo-badge-success", dot: "#22c55e", label: "Abierto" },
  drawing: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Sorteando" },
  lineup: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Lineup" },
  comodin_window: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Comodines" },
  in_progress: { cls: "vertigo-badge-danger", dot: "var(--vertigo-danger)", label: "En juego" },
  finished: { cls: "vertigo-badge-success", dot: "var(--vertigo-success)", label: "Finalizado" },
  disputed: { cls: "vertigo-badge-danger", dot: "var(--vertigo-danger)", label: "Disputa" },
  forfeit: { cls: "vertigo-badge-purple", dot: "var(--vertigo-faint)", label: "W.O." },
  cancelled: { cls: "vertigo-badge-purple", dot: "var(--vertigo-faint)", label: "Cancelado" },
};

// Statuses de match_game (no de match): la Partida N usa estos labels.
const GAME_STATUS_META: Record<string, string> = {
  pending: "Por jugar",
  drawing: "Sorteando",
  in_progress: "En juego",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

const COMODIN_LABEL: Record<string, string> = {
  reroll: "Reroll",
  anular: "Anular",
  elegir_rival: "Elegir rival",
  invocar_pro: "Invocar pro",
};

/** Orden del ciclo de vida de la llave — para el stepper de fases. */
const PHASE_STEPS: { key: string; label: string; short: string }[] = [
  { key: "scheduled", label: "Programada", short: "READY #1" },
  { key: "open", label: "Abierta", short: "Listos" },
  { key: "drawing", label: "Sorteo", short: "Ruleta" },
  { key: "lineup", label: "Lineup", short: "READY #2" },
  { key: "comodin_window", label: "Comodines", short: "5 min" },
  { key: "in_progress", label: "En juego", short: "AoE2" },
  { key: "finished", label: "Cerrada", short: "Fin" },
];

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

  // Chequeo lazy de la ventana de W.O. (sin auto-resolución: el ganador
  // sale del primer READY o de la decisión del admin):
  // cargar los datos así la página refleja el resultado real.
  try {
    await enforceMatchIfDue(id);
  } catch {
    // best-effort: el cron lo cubre si esto falla
  }

  // Sync lazy con AoE2 Companion: descubre la partida por nombre de sala,
  // archiva rec/análisis y auto-reporta el resultado si es válida.
  try {
    await syncAoe2IfDue(id);
  } catch {
    // best-effort: el cron y el reporte manual lo cubren
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
        aoe2_match_id, aoe2_sync_status, aoe2_checked_at, aoe2_flag, rec_storage_path,
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
  const hasDate = !!match.scheduled_at_start;
  // Fase de la ventana de READY (para el banner de decisión de W.O.).
  const readyPhaseNow = isScheduled && match.scheduled_at_start
    ? // eslint-disable-next-line react-hooks/purity -- RSC: se evalúa por request, no hay re-render
      computeReadyPhase(match.scheduled_at_start, match.status, Date.now())
    : null;

  // Próxima partida a sortear: P1 cuando no hay sorteo todavía,
  // P2/P3 cuando el BO3 quedó 1-1 y la siguiente partida sigue "pending".
  const nextDrawingGame = games.find((g: any) => g.status === "pending" && g.game_number > 1) ?? null;
  const canStartNextGameDraw = match.status === "in_progress" && !!nextDrawingGame;

  // Partida activa con sorteo hecho → nombre de sala AoE2 (derivación pura,
  // misma que usa el watcher para descubrir el resultado en Companion).
  const lobbyGame =
    games
      .filter((g: any) => g.map && g.status !== "finished")
      .sort((a: any, b: any) => b.game_number - a.game_number)[0] ?? null;
  const lobbyName = lobbyGame
    ? lobbyNameForGame({
        jornadaLabel: match.jornada_label,
        slotIndex: match.slot_index,
        gameNumber: lobbyGame.game_number,
        matchId: match.id,
      })
    : null;  const showLobbyBlock =
    !!lobbyName && !isFinished && !["disputed", "forfeit", "cancelled"].includes(match.status);

  // Stepper: índice de la fase actual dentro del ciclo (forfeit/cancelled no
  // tienen lugar en la línea — se muestran como estado terminal aparte).
  const phaseIndex = PHASE_STEPS.findIndex((s) => s.key === match.status);
  const isTerminalOdd = phaseIndex < 0; // forfeit / cancelled / disputed

  return (
    <div className="vertigo-fade-in">
      {/* Refresco en vivo: READY de capitanes, resultados y extensiones de
          ventana se reflejan sin tener que refrescar a mano. */}
      <MatchLiveRefresher matchId={match.id} />

      {/* ═══ HERO VS — el enfrentamiento como protagonista ═══ */}
      <section
        className="vertigo-card"
        style={{
          padding: 0, overflow: "hidden", position: "relative", marginBottom: "20px",
          border: "1px solid var(--vertigo-line)",
        }}
      >
        {/* Fondo de marca */}
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('/landing/castillo-vertigo.webp')",
          backgroundSize: "cover", backgroundPosition: "center 30%", opacity: 0.30,
        }} />
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(7,3,16,0.82) 0%, rgba(7,3,16,0.66) 50%, rgba(7,3,16,0.92) 100%)",
        }} />
        <div aria-hidden style={{
          position: "absolute", top: 0, left: "8%", right: "8%", height: 2,
          background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)",
        }} />

        {/* Barra superior: volver + kicker + stream */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "12px", flexWrap: "wrap",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(207,200,221,0.10)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            <Link
              href="/admin/jornadas"
              className="vertigo-btn vertigo-btn-ghost"
              style={{ padding: "7px 14px", fontSize: 10, flex: "none" }}
            >
              ← Jornadas
            </Link>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "var(--vertigo-purple-soft)", whiteSpace: "nowrap" }}>
              {match.round?.name ?? "PARTIDO"}
              {match.jornada_label ? ` · ${match.jornada_label}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "none" }}>
            <span className={`vertigo-badge ${meta.cls}`} style={{ fontSize: 11 }}>
              <span className="vertigo-status-dot" style={{ background: meta.dot }} />
              {meta.label}
            </span>
            <a
              href={`/overlay/${match.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="vertigo-btn vertigo-btn-ghost"
              style={{ padding: "7px 14px", fontSize: 10 }}
              title="Pantalla completa para el Browser Source de OBS"
            >
              <ExternalLink style={{ width: 11, height: 11 }} /> Vista stream
            </a>
          </div>
        </div>

        {/* Enfrentamiento central */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "clamp(20px, 4vw, 64px)",
          padding: "34px 24px 26px",
        }}>
          <HeroSide team={teamA} score={match.score_a} isWinner={!!winnerA} ready={match.ready_a_at} side="A" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flex: "none" }}>
            <span
              className="font-cinzel"
              style={{
                fontSize: "clamp(20px, 2.6vw, 34px)", fontWeight: 800, color: "#e9d18a",
                letterSpacing: "2px", textShadow: "0 0 22px rgba(212,175,55,0.45)",
              }}
            >
              VS
            </span>
            {match.format && (
              <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: 9, padding: "3px 10px" }}>
                {match.format}
              </span>
            )}
            <span style={{ fontSize: 11, color: "rgba(207,200,221,0.6)", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
              <Clock style={{ width: 11, height: 11 }} />
              {hasDate
                ? <LocalTime value={match.scheduled_at_start} variant="dateTime" />
                : <span style={{ color: "#fbbf24", fontWeight: 700 }}>SIN FECHA</span>}
            </span>
          </div>
          <HeroSide team={teamB} score={match.score_b} isWinner={!!winnerB} ready={match.ready_b_at} side="B" />
        </div>

        {/* ═══ STEPPER DE FASES — dónde está la llave y qué falta ═══ */}
        <div style={{
          position: "relative", zIndex: 2,
          borderTop: "1px solid rgba(207,200,221,0.10)",
          background: "rgba(7,3,16,0.72)",
          backdropFilter: "blur(8px)",
          padding: "14px 20px",
          overflowX: "auto",
        }}>
          {isTerminalOdd ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: meta.dot }}>
              <AlertTriangle style={{ width: 13, height: 13 }} />
              Llave {meta.label.toLowerCase()} — fuera del ciclo normal
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "fit-content", margin: "0 auto" }}>
              {PHASE_STEPS.map((step, i) => {
                const done = i < phaseIndex;
                const current = i === phaseIndex;
                const isLast = i === PHASE_STEPS.length - 1;
                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center", flex: "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", padding: "0 10px" }}>
                      <div
                        style={{
                          width: 26, height: 26, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: `1.5px solid ${current ? "#e9d18a" : done ? "rgba(34,197,94,0.6)" : "rgba(207,200,221,0.22)"}`,
                          background: current ? "rgba(212,175,55,0.14)" : done ? "rgba(34,197,94,0.10)" : "rgba(13,9,19,0.6)",
                          color: current ? "#e9d18a" : done ? "var(--vertigo-success)" : "var(--vertigo-faint)",
                          boxShadow: current ? "0 0 16px rgba(212,175,55,0.35)" : "none",
                          fontSize: 12, fontWeight: 800,
                        }}
                      >
                        {done ? <Check style={{ width: 13, height: 13 }} strokeWidth={3} /> : current && !isLast ? (
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e9d18a", display: "block" }} />
                        ) : i + 1}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
                        color: current ? "#e9d18a" : done ? "var(--vertigo-muted)" : "var(--vertigo-faint)",
                        whiteSpace: "nowrap",
                      }}>
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div style={{
                        width: "clamp(20px, 3.5vw, 54px)", height: 2, flex: "none",
                        background: done || current
                          ? i < phaseIndex ? "linear-gradient(90deg, rgba(34,197,94,0.55), rgba(34,197,94,0.3))" : "rgba(207,200,221,0.14)"
                          : "rgba(207,200,221,0.14)",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══ SIN FECHA: programación inline ═══ */}
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

      {/* ═══ W.O. — VENTANA DE DECISIÓN (tolerancia vencida, llave aún scheduled).
          Ya no hay auto-ganador: el reloj sigue corriendo y la decisión es del
          admin. Si un capitán confirma, avanza solo y esta card desaparece. */}
      {readyPhaseNow?.phase === "wo" && (
        <section className="mb-8">
          <div className="vertigo-wo" style={{ padding: "24px 26px" }}>
            <div className="flex items-start gap-4 mb-5">
              <div className="vertigo-nodate-medallion" style={{ width: 46, height: 46 }}>
                <AlertTriangle style={{ width: 21, height: 21 }} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2.2px", color: "var(--vertigo-danger)", opacity: 0.9 }}>
                  DECISIÓN REQUERIDA · ADMIN WIN
                </div>
                <div
                  className="font-cinzel"
                  style={{ fontSize: 17, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--vertigo-danger)", marginTop: 3 }}
                >
                  Tolerancia vencida — resolvé el W.O.
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--vertigo-muted)", margin: "8px 0 0", maxWidth: 660 }}>
                  El reloj sigue corriendo (+{fmtOverdue(readyPhaseNow.msPastDeadline ?? 0)} de demora):
                  si un capitán confirma READY, avanza solo. Si no aparece nadie, decidís vos
                  quién gana o reprogramás la llave.
                </p>
              </div>
            </div>
            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5"
              style={{ borderTop: "1px solid rgba(251,113,133,0.18)" }}
            >
              <div className="flex flex-col gap-3">
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", color: "var(--vertigo-faint)" }}>
                  OPCIÓN A · ADMIN WIN — ASIGNAR GANADOR
                </div>
                <ForfeitForm
                  matchId={match.id}
                  action={markForfeitFormAction}
                  teamAId={teamA?.id}
                  teamBId={teamB?.id}
                  teamAName={teamA?.team_account?.name}
                  teamBName={teamB?.team_account?.name}
                  requireWinner
                  buttonLabel="Asignar ganador (W.O.)"
                />
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
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ W.O. DOBLE SIN GANADOR ═══ */}
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
                  Decidís acá: asignar ganador (el rival avanza) o reprogramar la llave.
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
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ OPERACIÓN — UNA SOLA CARD CONTEXTUAL POR FASE ═══
          El "qué hago ahora" de la llave, ordenado por el stepper. */}
      <section className="mb-8">
        <div className="vertigo-card premium">
          <div className="vertigo-card-title" style={{ marginBottom: 16 }}>Operar la llave</div>

          {/* ── scheduled/open: ventana de READY + sorteo ── */}
          {(isScheduled || match.status === "open") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="vertigo-zone-label">Ventana de READY</div>
                {hasDate ? (
                  <>
                    <ReadyDeadlineTimer scheduledAtStart={match.scheduled_at_start} status={match.status} variant="block" />
                    <form action={extendReadyWindowFormAction} className="mt-4">
                      <input type="hidden" name="match_id" value={match.id} />
                      <div className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)] mb-2 flex items-center gap-1.5">
                        <Timer style={{ width: 11, height: 11 }} />
                        Extender ventana
                      </div>
                      <div className="flex gap-2">
                        {[5, 10, 15].map((m) => (
                          <button key={m} type="submit" name="minutes" value={m} className="vertigo-btn vertigo-btn-ghost flex-1 justify-center" style={{ padding: "10px 12px", fontSize: 11 }}>
                            <Plus style={{ width: 12, height: 12 }} /> {m} min
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-[var(--vertigo-faint)] leading-snug mt-2">
                        Mueve horario y límite de W.O. Los READY ya confirmados se conservan.
                      </p>
                    </form>
                  </>
                ) : (
                  <p className="text-[12px] text-[var(--vertigo-faint)] leading-relaxed">
                    La llave no tiene fecha: programala arriba para que exista la ventana de READY.
                  </p>
                )}
              </div>
              <div>
                <div className="vertigo-zone-label">Sorteo de la partida 1</div>
                <div className="flex flex-col gap-3">
                  <a
                    href={`/overlay/${match.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vertigo-btn vertigo-btn-primary"
                    style={{ textDecoration: "none", justifyContent: "center" }}
                  >
                    <Dices style={{ width: 14, height: 14 }} />
                    Abrir modo stream y sortear
                  </a>
                  <p className="text-[11px] text-[var(--vertigo-faint)] leading-snug">
                    {!hasDate
                      ? "⚠ Programá la fecha arriba: sin fecha no hay READY ni sorteo."
                      : match.ready_a_at && match.ready_b_at
                      ? "Se abre la stream en otra pestaña: el sorteo arranca desde ahí con INICIAR SORTEO (solo visible para vos, OBS no lo captura)."
                      : "Esperando READY #1 de ambos equipos para habilitar el sorteo."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── drawing: publicar ── */}
          {match.status === "drawing" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[var(--vertigo-muted)] leading-relaxed">
                ◆ El sorteo terminó y el resultado está en pantalla. Publicalo para que los
                capitanes declaren sus lineups — o re-girá una fase abajo si salió algo raro.
              </p>
              <form action={async () => { "use server"; await advanceToLineupAction(match.id); }}>
                <button type="submit" className="vertigo-btn vertigo-btn-primary">
                  <ArrowRight style={{ width: 14, height: 14 }} /> Publicar sorteo → Lineup
                </button>
              </form>
            </div>
          )}

          {/* ── lineup ── */}
          {match.status === "lineup" && (
            <div className="flex items-center gap-3 text-[13px] text-[var(--vertigo-muted)]">
              <span className="vertigo-status-dot" style={{ background: "#fbbf24" }} />
              Esperando que ambos equipos declaren lineup y confirmen READY #2.
              Cuando lo hagan, la ventana de comodines se abre sola.
              <div className="ml-auto flex flex-col gap-1 text-[11px]" style={{ color: "var(--vertigo-faint)" }}>
                <span>READY #2 A: {match.ready_lineup_a_at ? fmt.time(match.ready_lineup_a_at) : "—"}</span>
                <span>READY #2 B: {match.ready_lineup_b_at ? fmt.time(match.ready_lineup_b_at) : "—"}</span>
              </div>
            </div>
          )}

          {/* ── comodin_window ── */}
          {match.status === "comodin_window" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[13px]" style={{ color: "#fbbf24" }}>
                <Sparkles style={{ width: 15, height: 15 }} />
                Ventana de comodines abierta — los capitanes los usan al instante desde la página del partido y la carta sale en el stream sola.
              </div>
              <form action={async () => { "use server"; await closeComodinWindowAction(match.id); }}>
                <button type="submit" className="vertigo-btn vertigo-btn-success">
                  <Play style={{ width: 14, height: 14 }} /> Cerrar comodines → ¡Se juega!
                </button>
              </form>
            </div>
          )}

          {/* ── in_progress ── */}
          {match.status === "in_progress" && (
            <div className="flex flex-col gap-3">
              {canStartNextGameDraw && nextDrawingGame ? (
                <div className="flex flex-col gap-2">
                  <div className="text-[13px] text-[var(--vertigo-muted)]">
                    Serie 1-1: falta el sorteo de la partida decisiva.
                  </div>
                  <a
                    href={`/overlay/${match.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vertigo-btn vertigo-btn-primary"
                    style={{ textDecoration: "none", alignSelf: "flex-start" }}
                  >
                    <Dices style={{ width: 14, height: 14 }} /> Sortear partida {nextDrawingGame.game_number}
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--vertigo-success)" }}>
                  <span className="vertigo-status-dot" style={{ background: "var(--vertigo-success)" }} />
                  Partida en juego — el resultado se detecta solo por el nombre de sala.
                </div>
              )}
              {showLobbyBlock && lobbyGame && lobbyGame.status === "in_progress" && (
                <div style={{ marginTop: 6 }}>
                  <Aoe2SyncIndicator
                    syncStatus={lobbyGame.aoe2_sync_status ?? "pending"}
                    flag={lobbyGame.aoe2_flag ?? null}
                    aoe2MatchId={lobbyGame.aoe2_match_id ?? null}
                    startedAt={lobbyGame.started_at ?? null}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── disputed ── */}
          {match.status === "disputed" && (
            <Link href="/admin/disputas" className="vertigo-btn vertigo-btn-danger" style={{ alignSelf: "flex-start" }}>
              <AlertTriangle style={{ width: 14, height: 14 }} />
              Ver disputas
            </Link>
          )}

          {/* W.O. manual — siempre disponible mientras no termine */}
          {!isFinished && match.status !== "disputed" && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--vertigo-line-soft)" }}>
              <ForfeitForm
                matchId={match.id}
                action={markForfeitFormAction}
                teamAId={teamA?.id}
                teamBId={teamB?.id}
                teamAName={teamA?.team_account?.name}
                teamBName={teamB?.team_account?.name}
              />
            </div>
          )}
        </div>
      </section>

      {/* ═══ SALA AOE2 + SYNC (partida sorteada, sin terminar) ═══ */}
      {showLobbyBlock && lobbyGame && (
        <section className="mb-8">
          <div className="vertigo-card premium">
            <div className="vertigo-zone-label">Sala de AoE2 y resultado automático</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <LobbyNameCard name={lobbyName!} variant="block" />
              <div className="flex flex-col gap-3">
                {lobbyGame.status === "in_progress" ? (
                  <Aoe2SyncIndicator
                    syncStatus={lobbyGame.aoe2_sync_status ?? "pending"}
                    flag={lobbyGame.aoe2_flag ?? null}
                    aoe2MatchId={lobbyGame.aoe2_match_id ?? null}
                    startedAt={lobbyGame.started_at ?? null}
                  />
                ) : (
                  <p className="text-[11px] text-[var(--vertigo-faint)] leading-relaxed">
                    Cuando la partida esté en juego, el watcher busca este nombre en AoE2 Companion,
                    valida mapa y modo contra el sorteo, archiva el .aoe2record y el análisis, y carga
                    el resultado solo. Si algo no cierra, te lo muestra acá.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ PARTIDAS (sorteo + resultado por game) — cards compactas ═══ */}
      {games.length > 0 && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Partidas</div>
          <div className="flex flex-col gap-4">
            {games.map((g: any) => (
              <div key={g.id} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="vertigo-badge vertigo-badge-purple">Partida {g.game_number}</span>
                    <span className={`vertigo-badge ${STATUS_META[g.status]?.cls ?? "vertigo-badge-purple"}`}>
                      {GAME_STATUS_META[g.status] ?? STATUS_META[g.status]?.label ?? g.status}
                    </span>
                    {g.winner_team_id && (
                      <span className="vertigo-badge vertigo-badge-success">
                        {g.winner_team_id === teamA?.id ? (teamA?.team_account?.name ?? "A") : (teamB?.team_account?.name ?? "B")}
                      </span>
                    )}
                  </div>
                  {g.draw?.commit_hash && (
                    <span className="font-mono text-[11px] text-[var(--vertigo-faint)]">
                      {g.draw.commit_hash.slice(0, 16)}…
                    </span>
                  )}
                </div>

                {/* Sorteo en una tira compacta, no 5 cards gigantes */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Modo", value: g.game_mode },
                    { label: "Antimeta", value: g.antimeta_mode },
                    { label: "Formato", value: g.player_mode },
                    { label: "Mapa", value: g.map, icon: MapIcon },
                  ].map((cell) => (
                    <div
                      key={cell.label}
                      style={{
                        display: "inline-flex", alignItems: "baseline", gap: 7,
                        padding: "8px 14px", borderRadius: 9,
                        background: "rgba(13,9,19,0.6)", border: "1px solid var(--vertigo-line-soft)",
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--vertigo-faint)" }}>
                        {cell.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: cell.value ? "var(--vertigo-text)" : "var(--vertigo-faint)" }}>
                        {cell.value ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Re-girar fase (solo drawing) */}
                {match.status === "drawing" && g.draw && (
                  <div className="mt-3 pt-3 border-t border-[var(--vertigo-line-soft)]">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--vertigo-faint)] mb-2">Re-girar una fase (admin / comodín)</div>
                    <div className="flex flex-wrap gap-2">
                      {(["MODO","ANTIMETA","FORMATO","MAPA","LLAVE","CIVS"] as const).map((phase) => (
                        <RerollPhaseForm key={phase} matchId={match.id} gameNumber={g.game_number} phase={phase}>
                          <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }}>
                            <Shuffle style={{ width: 12, height: 12 }} /> {phase}
                          </button>
                        </RerollPhaseForm>
                      ))}
                    </div>
                  </div>
                )}

                {/* Civs sorteadas por equipo */}
                {(g.civs_a?.length > 0 || g.civs_b?.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-[var(--vertigo-line-soft)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: `Civs · ${teamA?.team_account?.name ?? "Equipo A"}`, civs: g.civs_a },
                      { label: `Civs · ${teamB?.team_account?.name ?? "Equipo B"}`, civs: g.civs_b },
                    ].map(({ label, civs }) => (
                      <div key={label}>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-2">{label}</div>
                        <div className="flex flex-wrap gap-1">
                          {(civs ?? []).map((c: string, i: number) => (
                            <span key={i} className="vertigo-badge vertigo-badge-purple">{c}</span>
                          ))}
                          {(!civs || civs.length === 0) && <span className="text-xs text-[var(--vertigo-faint)]">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reporte manual + vínculo forzado (game in_progress) */}
                {g.status === "in_progress" && (
                  <div className="mt-4 pt-4 border-t border-[var(--vertigo-line-soft)] flex flex-col gap-3">
                    <Aoe2SyncIndicator
                      syncStatus={g.aoe2_sync_status ?? "pending"}
                      flag={g.aoe2_flag ?? null}
                      aoe2MatchId={g.aoe2_match_id ?? null}
                      startedAt={g.started_at ?? null}
                    />
                    {g.aoe2_sync_status !== "synced" && (
                      <details>
                        <summary className="text-[11px] text-[var(--vertigo-faint)] cursor-pointer select-none">
                          ¿No se detecta sola? Vincular match de Companion manualmente
                        </summary>
                        <form action={linkAoe2MatchFormAction} className="mt-2 flex gap-2 flex-wrap items-center">
                          <input type="hidden" name="match_game_id" value={g.id} />
                          <input
                            type="text"
                            name="companion_ref"
                            required
                            placeholder="URL o id del match en aoe2companion.com"
                            className="flex-1 min-w-[240px] bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-input-border)] rounded-md px-3 py-2 text-[12px] text-[var(--vertigo-text)]"
                          />
                          <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }}>
                            <ExternalLink style={{ width: 12, height: 12 }} /> Vincular y reportar
                          </button>
                        </form>
                      </details>
                    )}
                    <form action={reportGameResultFormAction} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                      <input type="hidden" name="match_game_id" value={g.id} />
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Ganador (manual)</label>
                        <select name="winner_team_id" required className="bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-input-border)] rounded-md px-3 py-2.5 text-[13px] text-[var(--vertigo-text)]">
                          <option value="">— Elegí ganador —</option>
                          <option value={teamA?.id}>{teamA?.team_account?.name ?? "Equipo A"}</option>
                          <option value={teamB?.id}>{teamB?.team_account?.name ?? "Equipo B"}</option>
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
                )}
              </div>
            ))}
            {match.status === "in_progress" && games.filter((g: any) => g.status === "finished").length > 0 && (
              <p className="text-xs text-[var(--vertigo-faint)] italic">
                Partidas finalizadas: {games.filter((g: any) => g.status === "finished").length}
                {games.filter((g: any) => g.status === "finished" && g.aoe2_sync_status === "synced").length > 0 && (
                  <> · {games.filter((g: any) => g.status === "finished" && g.aoe2_sync_status === "synced").length} detectada(s) automáticamente en AoE2 Companion</>
                )}
                . {match.format === "BO3" ? "Si está 1-1, sorteá la partida decisiva." : ""}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ═══ LINEUPS + JUGADORES — reemplaza las TeamCards gigantes ═══ */}
      {games.length > 0 && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Lineups</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Equipo A", team: teamA, games, lineups: (g: any) => g.lineup_a, assignment: (g: any) => g.civ_assignment_a, ready: match.ready_lineup_a_at },
              { label: "Equipo B", team: teamB, games, lineups: (g: any) => g.lineup_b, assignment: (g: any) => g.civ_assignment_b, ready: match.ready_lineup_b_at },
            ].map(({ label, team, games, lineups, assignment, ready }) => (
              <div key={label} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {(team?.team_account?.emblem?.image_url ?? null) ? (
                      <div className="flex-none overflow-hidden rounded-full border border-[rgba(212,175,55,0.5)]" style={{ width: 34, height: 34 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={team.team_account.emblem.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-full border border-[var(--vertigo-purple)] text-[var(--vertigo-purple-soft)] flex-none" style={{ width: 34, height: 34 }}>
                        <Shield style={{ width: 15, height: 15 }} strokeWidth={1.25} />
                      </div>
                    )}
                    <div className="font-cinzel text-base text-[var(--vertigo-text)] truncate">
                      {team?.team_account?.name ?? label}
                    </div>
                  </div>
                  {ready ? (
                    <span className="vertigo-badge vertigo-badge-success" style={{ fontSize: 9 }}>
                      <CheckCircle2 style={{ width: 10, height: 10 }} /> READY #2
                    </span>
                  ) : (
                    <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: 9 }}>READY #2 —</span>
                  )}
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
                {/* Plantilla completa al pie */}
                <div className="mt-3 pt-3 border-t border-[var(--vertigo-line-soft)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-2">Plantilla</div>
                  <div className="flex flex-wrap gap-1">
                    {(team?.players ?? []).map((p: any) => (
                      <span key={p.id} className="vertigo-badge vertigo-badge-purple">
                        {p.is_captain ? "★ " : ""}{p.display_name}
                        {p.max_rating_rm_1v1 != null && (
                          <span className="text-[var(--vertigo-faint)] ml-1">{p.max_rating_rm_1v1}</span>
                        )}
                      </span>
                    ))}
                    {(team?.players ?? []).length === 0 && <span className="text-xs text-[var(--vertigo-faint)]">Sin jugadores</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ COMODINES USADOS — compacto ═══ */}
      {comodinUsages.length > 0 && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Comodines usados</div>
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
                {c.status === "pending" && (
                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[var(--vertigo-line-soft)]">
                    <div className="text-[11px] text-[var(--vertigo-faint)]">
                      Pedido pendiente de una versión anterior — los comodines ya se ejecutan al instante desde el panel del capitán.
                    </div>
                    <div className="flex gap-2">
                      <form action={executeComodinFormAction}>
                        <input type="hidden" name="comodin_usage_id" value={c.id} />
                        <button type="submit" className="vertigo-btn vertigo-btn-primary" style={{ padding: "8px 16px", fontSize: 11 }}>
                          <CheckCircle2 style={{ width: 12, height: 12 }} />
                          Ejecutar (legado)
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
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ RESULTADO FINAL ═══ */}
      {isFinished && (
        <section>
          <div className="vertigo-subtitle">Resultado final</div>
          <div className="vertigo-card">
            <div className="flex items-center gap-4">
              <Trophy style={{ width: 28, height: 28, color: "var(--vertigo-gold)" }} strokeWidth={1.5} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">Ganador</div>
                <div className="font-cinzel text-xl text-[var(--vertigo-text)]">
                  {winnerA ? teamA?.team_account?.name : winnerB ? teamB?.team_account?.name : "—"}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">Score</div>
                <div className="font-cinzel text-2xl text-[var(--vertigo-gold)]">
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

/** Lado del hero VS: escudo + nombre + score + READY #1. */
function HeroSide({
  team,
  score,
  isWinner,
  ready,
  side,
}: {
  team: any;
  score: number;
  isWinner: boolean;
  ready: string | null;
  side: "A" | "B";
}) {
  const name = team?.team_account?.name ?? "Por definir";
  const emblemUrl = team?.team_account?.emblem?.image_url ?? null;
  const seed = team?.seed;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", flex: "0 1 32%", minWidth: 0 }}>
      <div style={{
        width: "clamp(84px, 9vw, 150px)", height: "clamp(84px, 9vw, 150px)",
        borderRadius: 20, overflow: "hidden", flexShrink: 0,
        border: `2px solid ${isWinner ? "rgba(212,175,55,0.8)" : "rgba(212,175,55,0.4)"}`,
        background: "rgba(13,9,19,0.75)",
        boxShadow: isWinner
          ? "0 0 40px rgba(212,175,55,0.35), 0 14px 34px rgba(0,0,0,0.6)"
          : "0 14px 34px rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        {emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emblemUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Shield style={{ width: "42%", height: "42%", color: "var(--vertigo-purple-soft)", opacity: 0.5 }} strokeWidth={1.1} />
        )}
        {seed != null && (
          <span style={{
            position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)",
            background: "rgba(124,58,237,0.95)", border: "1.5px solid var(--vertigo-purple)",
            borderRadius: 999, padding: "1px 9px", fontSize: 9, fontWeight: 700, color: "#fff",
            fontFamily: "Cinzel, serif", whiteSpace: "nowrap",
          }}>
            SEED {seed}
          </span>
        )}
      </div>

      <div
        className="font-cinzel"
        style={{
          fontSize: "clamp(16px, 2.1vw, 30px)", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center",
          color: isWinner ? "#e9d18a" : "var(--vertigo-text)",
          textShadow: "0 2px 18px rgba(0,0,0,0.8)",
          overflowWrap: "anywhere", lineHeight: 1.1,
          maxWidth: "100%",
        }}
      >
        {name}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          className="font-cinzel"
          style={{
            fontSize: "clamp(26px, 3.2vw, 46px)", fontWeight: 700, lineHeight: 1,
            color: isWinner ? "#e9d18a" : "var(--vertigo-muted)",
            fontVariantNumeric: "tabular-nums",
            textShadow: isWinner ? "0 0 24px rgba(212,175,55,0.4)" : "none",
          }}
        >
          {score}
        </span>
        {ready && (
          <span className="vertigo-badge vertigo-badge-success" style={{ fontSize: 8, padding: "2px 8px" }}>
            <CheckCircle2 style={{ width: 9, height: 9 }} /> READY
          </span>
        )}
      </div>
    </div>
  );
}
