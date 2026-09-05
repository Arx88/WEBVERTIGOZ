"use client";

/**
 * VÉRTIGO Cup — CaptainMatchPanel
 *
 * Vista contextual del partido para el CAPITÁN que está jugando esta llave.
 * Se monta sobre /partido/[id] cuando el usuario logueado es capitán de
 * team A o team B. Aquí vive toda la experiencia del capitán en su partido:
 *
 *  - Countdown al inicio + READY #1
 *  - Ver el resultado del sorteo (su equipo y sus civs)
 *  - Declarar lineup (si el formato no es 3v3/FUSIÓN)
 *  - READY #2 (ambos confirmaron lineup)
 *  - Ventana de comodines de 5 min (modal fullscreen, solicitar comodín)
 *
 * Recibe el match del realtime wrapper (ya actualizado por postgres_changes).
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { civName } from "@/lib/constants/civs";
import ConfirmReadyForm from "@/components/captain/confirm-ready-form";
import {
  declareLineupFormAction,
  confirmLineupReadyFormAction,
  useComodinFormAction,
} from "@/server/actions/match-day";
import ReadyDeadlineTimer, { useReadyWindow } from "@/components/shared/ready-deadline-timer";
import { NoDateBanner } from "@/components/shared/no-date-banner";
import { useAutoScrollOnPhase, usePhaseEnter } from "@/app/(public)/partido/[id]/realtime-hooks";
import {
  CheckCircle2, Users, Sword, Timer, Sparkles, Loader2, AlertCircle, Clock, AlertTriangle, RotateCcw,
} from "lucide-react";

interface TeamLite {
  id: string;
  name: string;
  seed: number | null;
}

interface PlayerLite {
  id: string;
  display_name: string;
  is_captain: boolean;
}

/**
 * Contexto del capitán resuelto en el server — todo lo que necesita el panel
 * para renderizar la vista contextual del partido.
 */
export interface CaptainPanelContext {
  myTeamRegId: string;
  teamA_id: string;
  teamB_id: string;
  myPlayers: PlayerLite[];
  /** Roster del equipo RIVAL (para los comodines ANULAR / ELEGIR RIVAL) */
  rivalPlayers: PlayerLite[];
  annulledPlayerIds: string[];
  /** Jugadores del RIVAL ya anulados en este match (para deshabilitarlos como objetivo) */
  rivalAnnulledPlayerIds: string[];
  /** Usos restantes de cada comodín (para la grilla de la ventana) */
  comodinInventory: ComodinInventoryLite;
}

/** Usos restantes por comodín (inventario del capitán). */
export interface ComodinInventoryLite {
  reroll: number;
  anular: number;
  elegirRival: number;
  invocarPro: number;
}

interface Props {
  matchId: string;
  status: string;
  /** Horario programado de la llave (null = sin fecha). Gating de la ventana READY. */
  scheduledAtStart: string | null;
  /** Mi team_registration.id si soy capitán de un equipo de este match; null si no lo soy */
  myTeamRegId: string | null;
  teamA: TeamLite | null;
  teamB: TeamLite | null;
  /** Roster del equipo del capitán (sus 3 jugadores) */
  myPlayers: PlayerLite[];
  /** Roster del RIVAL — para los comodines ANULAR / ELEGIR RIVAL */
  rivalPlayers: PlayerLite[];
  /** Jugadores ya anulados en este match (por comodín ANULAR) */
  annulledPlayerIds: string[];
  /** Jugadores del RIVAL ya anulados (objetivo inválido para ANULAR/ELEGIR otra vez) */
  rivalAnnulledPlayerIds: string[];
  /** Usos restantes de cada comodín (grilla de la ventana) */
  comodinInventory: ComodinInventoryLite;
  /** Todos los usos del match — el panel deriva la exclusión mutua
      anular↔elegir_rival (usage de MI equipo del otro tipo con status
      ∉ {cancelled, revoked}, igual que el server). */
  comodinUsages: {
    comodinType: string;
    status: string;
    teamRegId: string | null;
  }[];
  readyA: boolean;
  readyB: boolean;
  readyLineupA: boolean;
  readyLineupB: boolean;
  /** player_mode de la partida activa (1v1/2v2/3v3/fusion) — define cuántos juegan.
      NO es lo mismo que match.format (que es BO3/BO1). */
  playerMode: string | null;
  /** Civs sorteadas para MI equipo en la partida activa (pool para asignar). */
  myCivs: string[];
  /** Lineup ya declarado por MI equipo en la partida activa (si existe):
      IDs de jugadores + civ asignada por jugador. Sirve para mostrar un
      resumen en vez del form cuando ya se declaró/confirmó. */
  myLineup: string[];
  myCivAssignment: Record<string, string>;
  /** comodin_window_expires_at */
  comodinExpiresAt: string | null;
  /** Nombre de sala AoE2 de la partida activa (derivado, no guardado).
      Con esto el capitán crea la sala y el resultado se detecta solo. */
  lobbyName?: string | null;
  /** Partida activa (mapa/modo/civs) — para mostrar el resultado del sorteo
      en drawing/lineup desde el panel, no solo en las cards de abajo. */
  activeGame?: {
    map: string | null;
    gameMode: string | null;
    playerMode: string | null;
    civsA: string[];
    civsB: string[];
  } | null;
}

export function CaptainMatchPanel({
  matchId,
  status,
  scheduledAtStart,
  myTeamRegId,
  teamA,
  teamB,
  myPlayers,
  rivalPlayers,
  annulledPlayerIds,
  rivalAnnulledPlayerIds,
  comodinInventory,
  comodinUsages,
  readyA,
  readyB,
  readyLineupA,
  readyLineupB,
  playerMode,
  myCivs,
  myLineup = [],
  myCivAssignment = {},
  comodinExpiresAt,
  lobbyName = null,
  /** Partida activa del match (mapa/modo/civs sorteadas) — el panel muestra
      el resultado del sorteo en fases drawing/lineup, no solo su nombre. */
  activeGame = null,
}: Props) {
  const isMyTeamA = myTeamRegId === teamA?.id;
  const myTeam = isMyTeamA ? teamA : teamB;
  const myReady = isMyTeamA ? readyA : readyB;
  const myReadyLineup = isMyTeamA ? readyLineupA : readyLineupB;
  const rivalReadyLineup = isMyTeamA ? readyLineupB : readyLineupA;
  const rivalReady = isMyTeamA ? readyB : readyA;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Ventana de READY: [15 min antes del horario, 15 min después] (tolerancia W.O.)
  const { phase: readyPhase } = useReadyWindow(scheduledAtStart, status);

  // ===== UX de fases en vivo: auto-scroll + glow cuando el status cambia.
  // phaseKey separa la RE-apertura del lineup (admin re-abrió tras un comodín:
  // lineup declarado pero mi READY#2 quedó en false → hay que re-declarar).
  const needsRedeclare = status === "lineup" && !myReadyLineup;
  const phaseKey = `${status}:${needsRedeclare ? "redeclare" : "normal"}`;
  const sectionRef = useAutoScrollOnPhase<HTMLDivElement>(phaseKey);
  const phaseCls = usePhaseEnter(phaseKey);

  const panelClasses = "vertigo-card";
  const isCaptainOfThisMatch = !!myTeamRegId;

  if (!isCaptainOfThisMatch) return null;

  // Cabecera de sección de la fase (estilo demo: tag + título + rule)
  const phaseHead = (tag: string, title: string) => (
    <div className="match-sec-head">
      <span className="tag">{tag}</span>
      <h2>{title}</h2>
      <span className="rule" />
    </div>
  );

  // ===== READY #2 view (declarar lineup + confirmar)
  if (status === "lineup") {
    // Ya declaraste Y confirmaste READY → resumen (no el form de nuevo: el form
    // deshabilitado con contadores en cero era confuso). Si el admin re-abrió
    // el lineup (comodín ANULAR/ELEGIR_RIVAL → ready_lineup=null), vuelve el
    // form para re-declarar: el lineup guardado puede estar incompleto o sin
    // el jugador forzado, no es un resumen válido.
    const myDeclared = myLineup.length > 0;
    const showSummary = myDeclared && myReadyLineup;
    return (
      <div ref={sectionRef} className="captain-phase-anchor">
        {phaseHead("Fase · Lineup", showSummary ? "Lineup declarado" : myDeclared ? "Re-declará el lineup" : `¿Quiénes juegan el ${(playerMode ?? "").toUpperCase() === "1V1" ? "1 VS 1" : (playerMode ?? "").toUpperCase() === "2V2" ? "2 VS 2" : (playerMode ?? "").toUpperCase() || "encuentro"}?`)}
        <div className={panelClasses}>
        <div className="vertigo-card-header">
          <div className="vertigo-card-title">
            <Users style={{ width: 14, height: 14, display: "inline", marginRight: 8 }} />
            {myDeclared ? `Lineup de ${myTeam?.name ?? "tu equipo"}` : `Declarar lineup de ${myTeam?.name ?? "tu equipo"}`}
          </div>
          <span className="vertigo-badge vertigo-badge-purple">LINEUP</span>
        </div>
        {showSummary ? (
          <>
            <div
              style={{
                padding: "14px 18px",
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <CheckCircle2 style={{ width: 20, height: 20, color: "var(--vertigo-success)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "1px", color: "var(--vertigo-success)" }}>
                  {myReadyLineup ? "✓ LINEUP CONFIRMADO" : "Lineup declarado — confirmá READY"}
                </div>
                <div style={{ fontSize: 12, color: "var(--vertigo-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {myLineup.map((pid) => {
                    const p = myPlayers.find((x) => x.id === pid);
                    const civ = myCivAssignment[pid];
                    return (
                      <span
                        key={pid}
                        className="vertigo-badge vertigo-badge-purple"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        {p?.is_captain ? "★ " : ""}{p?.display_name ?? "Jugador"}
                        {civ && (
                          <>
                            <img src={`/civs/${civ}.webp`} alt="" style={{ width: 14, height: 14, objectFit: "contain" }} />
                            {civName(civ)}
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, color: "var(--vertigo-faint)", marginTop: 4 }}>
                  {myReadyLineup
                    ? rivalReadyLineup
                      ? "Ambos equipos confirmaron. Esperando que el admin abra la ventana de comodines."
                      : "Esperando que el rival confirme su lineup…"
                    : "Tu selección quedó registrada."}
                </div>
              </div>
            </div>
            {/* Vía de escape: si el admin re-abre el lineup (p.ej. tras un
                comodín ANULAR), el capitán puede volver a declarar. */}
            {!myReadyLineup && (
              <div className="text-[12px] text-[var(--vertigo-faint)] mt-3">
                Si el admin re-abre el lineup tras un comodín, volvé a declararlo desde acá cuando cambie.
              </div>
            )}
          </>
        ) : (
          <>
            {myDeclared && (
              <div
                className="mb-4"
                style={{
                  padding: "12px 16px",
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(251,191,36,0.35)",
                  borderRadius: "10px",
                  fontSize: 13,
                  color: "#fbbf24",
                  lineHeight: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>
                  Un comodín re-abrió el lineup de esta llave.{" "}
                  {annulledPlayerIds.length > 0
                    ? "Tenés jugador(es) anulado(s) — elegí de nuevo quién juega."
                    : "Re-declará tu lineup para continuar."}
                </span>
              </div>
            )}
            <p className="text-sm text-[var(--vertigo-muted)] mb-4 leading-relaxed">
              Primero elegí <strong style={{ color: "var(--vertigo-text)" }}>quiénes juegan</strong>, después la{" "}
              <strong style={{ color: "var(--vertigo-text)" }}>civilización de cada uno</strong> y declará. Cuando ambos equipos confirmen, abre la ventana de comodines (5 min).
            </p>
            <CaptainLineupForm
              matchId={matchId}
              myPlayers={myPlayers}
              annulledPlayerIds={annulledPlayerIds}
              playerModeExpected={playerMode}
              myCivs={myCivs}
              readyLineup={myReadyLineup}
              pending={pending}
              onSubmit={(playerIds, civAssignment) => {
                setError(null); setSuccessMsg(null);
                startTransition(async () => {
                  try {
                    const fd = new FormData();
                    // Necesitamos el match_game_id — lo resolvemos acá
                    const gameId = await fetchCurrentGameId(matchId);
                    if (!gameId) throw new Error("No se encontró la partida en curso.");
                    fd.set("match_game_id", gameId);
                    fd.set("player_ids", JSON.stringify(playerIds));
                    fd.set("civ_assignment", JSON.stringify(civAssignment));
                    await declareLineupFormAction(fd);
                    // Luego confirmar READY #2
                    const fd2 = new FormData();
                    fd2.set("match_id", matchId);
                    await confirmLineupReadyFormAction(fd2);
                    setSuccessMsg("Lineup declarado y READY confirmado. Esperando al rival…");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Error al declarar lineup.");
                  }
                });
              }}
            />
          </>
        )}
        {error && <div className="mt-3 text-sm text-[var(--vertigo-danger)] flex items-center gap-2"><AlertCircle style={{ width: 14, height: 14 }} />{error}</div>}
        {successMsg && <div className="mt-3 text-sm text-[var(--vertigo-success)]">{successMsg}</div>}
        {/* La sala se muestra UNA sola vez, en la sección Sala del scoreboard
            (wrapper) — nunca duplicada acá. */}
      </div>
      </div>
    );
  }

  // ===== Ventana de comodines
  if (status === "comodin_window") {
    return (
      <div ref={sectionRef} className="captain-phase-anchor">
        {phaseHead("Fase · Ventana 5:00", "Comodines de la llave")}
        <ComodinPrompt
          phaseCls={phaseCls}
          matchId={matchId}
          comodinExpiresAt={comodinExpiresAt}
          myTeamName={myTeam?.name ?? "Tu equipo"}
          rivalTeamName={!isMyTeamA ? teamA?.name ?? "Rival" : teamB?.name ?? "Rival"}
          rivalPlayers={rivalPlayers}
          rivalAnnulled={rivalAnnulledPlayerIds}
          playerMode={playerMode}
          comodinInventory={comodinInventory}
          myTeamRegId={myTeamRegId}
          comodinUsages={comodinUsages}
        />
      </div>
    );
  }

  // ===== Esperando sorteo / partido en curso — contexto para el capitán.
  // El countdown y el estado ya viven en el scoreboard (arriba); este panel
  // es la ACCIÓN del capitán: READY #1 para habilitar la llave.
  const waitingStart = status === "scheduled" || status === "open";
  const phaseTag =
    status === "drawing" ? "Fase · Sorteo"
    : status === "in_progress" ? "Fase · En juego"
    : waitingStart ? "Fase · Confirmación"
    : "Tu partido";
  const phaseTitle =
    status === "drawing" ? "El sorteo definió la partida"
    : status === "in_progress" ? "¡A ganar!"
    : waitingStart ? (myReady ? "Estás listo" : "Confirmá tu asistencia")
    : `Tu partido — ${myTeam?.name ?? ""}`;
  return (
    <div ref={sectionRef} className="captain-phase-anchor">
      {phaseHead(phaseTag, phaseTitle)}
      <div className={`${panelClasses} ${phaseCls}`}>
      <div className="vertigo-card-header">
        <div className="vertigo-card-title">
          <Sword style={{ width: 14, height: 14, display: "inline", marginRight: 8, color: "var(--vertigo-purple-soft)" }} />
          Tu partido — {myTeam?.name}
        </div>
        {waitingStart && myReady && rivalReady && (
          <span className="vertigo-badge vertigo-badge-success">LLAVE HABILITADA</span>
        )}
      </div>

      {/* READY #1: confirmar asistencia para habilitar la llave.
          Solo dentro de la ventana: desde 15 min antes del horario hasta
          15 min después (tolerancia). Sin fecha confirmada no hay botón:
          se muestra el banner de "horario a confirmar". */}
      {waitingStart && !myReady && readyPhase === "no-date" && <NoDateBanner />}

      {/* Ya confirmaste: banner verde prominente con estado del rival */}
      {waitingStart && myReady && (
        <>
          <div
            style={{
              padding: "14px 18px",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <CheckCircle2 style={{ width: 20, height: 20, color: "var(--vertigo-success)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "1px", color: "var(--vertigo-success)" }}>
                ✓ ESTÁS LISTO
              </div>
              <div style={{ fontSize: 12, color: "var(--vertigo-muted)", marginTop: 2 }}>
                {rivalReady
                  ? "¡El rival también está listo! Aguardando al admin para el sorteo."
                  : "Tu confirmación quedó registrada. Esperando al rival…"}
              </div>
            </div>
          </div>
          <div className="text-[12px] text-[var(--vertigo-faint)] mt-3 flex items-center gap-2 flex-wrap">
            <Timer style={{ width: 12, height: 12, flexShrink: 0 }} />
            <ReadyDeadlineTimer scheduledAtStart={scheduledAtStart} status={status} variant="chip" />
          </div>
        </>
      )}

      {waitingStart && !myReady && readyPhase !== "no-date" && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-[var(--vertigo-muted)]">
              {readyPhase === "early"
                ? "Confirmá tu asistencia cuando se abra la ventana."
                : readyPhase === "wo"
                ? "Ventana de decisión: confirmá para avanzar o el admin resuelve el W.O."
                : "Confirmá tu asistencia para habilitar la llave."}
            </div>
            {!myReady && readyPhase === "early" && (
              <button
                type="button"
                className="vertigo-btn vertigo-btn-success"
                disabled
                title="Se habilita 15 minutos antes del horario de la llave"
                style={{ fontSize: 11, padding: "10px 20px" }}
              >
                <CheckCircle2 style={{ width: 14, height: 14 }} />
                ESTOY LISTO
              </button>
            )}
            {!myReady && (readyPhase === "open" || readyPhase === "grace" || readyPhase === "wo") && (
              <ConfirmReadyForm matchId={matchId} phase={readyPhase} />
            )}
          </div>
          <div className="text-[12px] text-[var(--vertigo-faint)] mt-3 flex items-center gap-2 flex-wrap">
            <Timer style={{ width: 12, height: 12, flexShrink: 0 }} />
            <ReadyDeadlineTimer scheduledAtStart={scheduledAtStart} status={status} variant="chip" />
            <span className="text-[var(--vertigo-faint)]">
              · Si no confirmás dentro de la ventana, el admin puede darte por W.O.
            </span>
          </div>
        </>
      )}
      {status === "drawing" && (
        <>
          {/* El resultado del sorteo YA está decidido (startDrawAction lo
              persiste revelado antes de animar): el capitán lo ve acá mismo,
              sin esperar a que el admin publique el lineup. */}
          {activeGame && activeGame.map ? (
            <>
              <div className="text-sm text-[var(--vertigo-purple-soft)] mb-3">
                ◆ Sorteo realizado — así se juega esta partida:
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { label: "Mapa", value: activeGame.map },
                  { label: "Modo", value: activeGame.gameMode },
                  { label: "Formato", value: activeGame.playerMode },
                ].filter((c) => !!c.value).map((c) => (
                  <span
                    key={c.label}
                    className="text-[12px] rounded-lg"
                    style={{
                      padding: "8px 14px",
                      background: "rgba(13,9,19,0.6)",
                      border: "1px solid var(--vertigo-line-soft)",
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginRight: 7 }}>
                      {c.label}
                    </span>
                    <strong style={{ color: "var(--vertigo-text)" }}>{c.value}</strong>
                  </span>
                ))}
              </div>
              <MyCivChips
                myCivs={isMyTeamA ? activeGame.civsA : activeGame.civsB}
                label="Tus civs sorteadas"
              />
            </>
          ) : (
            <div className="text-sm text-[var(--vertigo-purple-soft)]">
              ◆ La ruleta está girando. El resultado aparece acá apenas termina.
            </div>
          )}
          {activeGame && activeGame.map && (
            <div className="text-[12px] text-[var(--vertigo-faint)] mt-3">
              El admin lo publica en el stream y se abre la fase de lineup.
            </div>
          )}
        </>
      )}
      {status === "in_progress" && (
        <div className="text-sm text-[var(--vertigo-success)]">▶ Partida en juego. ¡A ganar!</div>
      )}
    </div>
    </div>
  );
}

// ============================================================
// Form de lineup (elegir qué jugadores juegan)
// ============================================================

function CaptainLineupForm({
  matchId,
  myPlayers,
  annulledPlayerIds,
  playerModeExpected,
  myCivs,
  readyLineup,
  pending,
  onSubmit,
}: {
  matchId: string;
  myPlayers: PlayerLite[];
  annulledPlayerIds: string[];
  playerModeExpected: string | null;
  myCivs: string[];
  readyLineup: boolean;
  pending: boolean;
  onSubmit: (playerIds: string[], civAssignment: Record<string, string>) => void;
}) {
  const available = myPlayers.filter((p) => !annulledPlayerIds.includes(p.id));
  const expected = playersForMode(playerModeExpected);
  // La selección arranca VACÍA: la pregunta "¿quiénes juegan?" es explícita —
  // nada pre-marcado que el capitán pueda declarar sin haber mirado.
  const [selected, setSelected] = useState<string[]>([]);
  // player_id → civ_id. Cada jugador seleccionado elige UNA civ del pool.
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [civError, setCivError] = useState<string | null>(null);

  useEffect(() => {
    setSelected((cur) => cur.filter((id) => !annulledPlayerIds.includes(id)));
  }, [annulledPlayerIds]);

  // Al cambiar la selección, el estado de civs SIEMPRE queda saneado:
  // solo existen entradas para jugadores seleccionados — así una civ nunca
  // queda "tomada" por un jugador que ya sacaste.
  useEffect(() => {
    setAssign((cur) => {
      const next: Record<string, string> = {};
      for (const pid of selected) next[pid] = cur[pid];
      return Object.keys(next).length === Object.keys(cur).length && Object.entries(next).every(([k, v]) => cur[k] === v) ? cur : next;
    });
  }, [selected]);

  const toggle = (id: string) => {
    setCivError(null);
    if (expected === 1) {
      // 1v1: tocar un jugador lo SELECCIONA (radio) — uno solo, nunca cero.
      setSelected([id]);
      return;
    }
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < expected ? [...cur, id] : cur));
  };

  if (expected === 0) {
    return (
      <div className="text-sm text-[var(--vertigo-muted)] italic">
        Modo 3v3 o FUSIÓN: juega todo el equipo, no hay lineup que declarar. Confirmá READY abajo.
        <LineupReadyOnly matchId={matchId} readyLineup={readyLineup} />
      </div>
    );
  }

  const usedCivs = new Set(Object.values(assign));
  const assignedCount = selected.filter((pid) => !!assign[pid]).length;
  const allAssignmentsDone = selected.length > 0 && selected.every((pid) => !!assign[pid]);

  const handleConfirm = () => {
    if (selected.length !== expected) return;
    if (!allAssignmentsDone) {
      setCivError("Elegí una civ para cada jugador seleccionado.");
      return;
    }
    // Enviar solo los jugadores seleccionados con su asignación
    const assignment: Record<string, string> = {};
    for (const pid of selected) assignment[pid] = assign[pid];
    onSubmit(selected, assignment);
  };

  return (
    <div className="lineup-body">
      {/* ── PASO 1: ¿quiénes juegan? ── */}
      <div>
        <div className="step-label">
          1 · ¿Quiénes juegan esta partida? <b>({selected.length} de {expected})</b>
        </div>
        <div className="roster" style={{ marginTop: 10 }}>
          {myPlayers.map((p) => {
            const isSelected = selected.includes(p.id);
            const isAnnulled = annulledPlayerIds.includes(p.id);
            const civ = assign[p.id];
            return (
              <button
                key={p.id}
                type="button"
                disabled={isAnnulled || pending || readyLineup}
                onClick={() => toggle(p.id)}
                className={`lineup-seat ${isSelected ? "selected" : ""}`}
                aria-pressed={isSelected}
              >
                <span className="avatar">
                  {civ ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/civs/${civ}.webp`} alt="" />
                  ) : (
                    p.display_name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="info">
                  <span className="nick">{p.display_name}</span>
                  <span className="sub">
                    {isAnnulled ? "Anulado por comodín" : p.is_captain ? "★ Capitán" : "Jugador"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PASO 2: una pregunta por jugador — ¿qué civ usa cada uno? ── */}
      {selected.length > 0 && myCivs.length > 0 && (
        <div>
          <div className="step-label">2 · Asigná la civilización de cada jugador</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {selected.map((pid) => {
              const player = myPlayers.find((p) => p.id === pid);
              const currentCiv = assign[pid] ?? null;
              return (
                <div key={pid} className="lineup-assign-row">
                  <span className="player">
                    <span className="avatar">
                      {currentCiv ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/civs/${currentCiv}.webp`} alt="" />
                      ) : (
                        (player?.display_name ?? "?").slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="nick">{player?.display_name ?? pid.slice(0, 8)}</span>
                    {player?.is_captain && <span className="star">★</span>}
                  </span>
                  <div className="civ-pool">
                    {myCivs.map((civ) => {
                      const taken = usedCivs.has(civ) && assign[pid] !== civ;
                      const chosen = assign[pid] === civ;
                      return (
                        <button
                          key={civ}
                          type="button"
                          disabled={pending || readyLineup}
                          onClick={() => { setCivError(null); setAssign((cur) => ({ ...cur, [pid]: civ })); }}
                          className={`civ-pick ${chosen ? "chosen" : ""} ${taken ? "taken" : ""}`}
                          title={taken ? "Civ ya asignada a otro jugador" : undefined}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/civs/${civ}.webp`} alt="" />
                          {civName(civ)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {civError && <div className="text-[13px] text-[var(--vertigo-danger)]">{civError}</div>}

      {/* ── Resumen + acciones: Declarar o empezar de nuevo ── */}
      <div className="lineup-summary">
        <span className="lineup-count">
          Seleccionados: <b>{selected.length} / {expected}</b>
          {selected.length > 0 && myCivs.length > 0 && (
            <> · Civs asignadas: <b>{Object.keys(assign).filter((pid) => selected.includes(pid) && assign[pid]).length} / {selected.length}</b></>
          )}
        </span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!readyLineup && (selected.length > 0 || Object.keys(assign).length > 0) && (
            <button
              type="button"
              className="vertigo-btn vertigo-btn-ghost"
              onClick={() => { setSelected([]); setAssign({}); setCivError(null); }}
              disabled={pending}
            >
              <RotateCcw style={{ width: 14, height: 14 }} />
              Reiniciar
            </button>
          )}
          {!readyLineup ? (
            <button
              type="button"
              className="vertigo-btn vertigo-btn-primary"
              disabled={selected.length !== expected || pending || (myCivs.length > 0 && !allAssignmentsDone)}
              onClick={handleConfirm}
            >
              {pending ? (
                <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
              ) : (
                <CheckCircle2 style={{ width: 14, height: 14 }} />
              )}
              Declarar lineup + READY
            </button>
          ) : (
            <span className="text-sm text-[var(--vertigo-success)]">✓ Lineup declarado</span>
          )}
        </div>
      </div>

      {/* Banda de confirmación al pie — el estado del flujo */}
      <div className="ready-band">
        <div className={`ready-status ${allAssignmentsDone && selected.length === expected ? "ok" : ""}`}>
          <i />
          {allAssignmentsDone && selected.length === expected
            ? "Listo para declarar"
            : selected.length === 0
              ? "Todavía no elegiste jugadores"
              : selected.length < expected
                ? `Elegí ${expected - selected.length === 1 ? "un jugador más" : `${expected - selected.length} jugadores más`}`
                : assignedCount < selected.length
                  ? `Asigná la civ: falta${selected.length - assignedCount > 1 ? "n" : ""} ${selected.length - assignedCount}`
                  : "Revisá la asignación"}
        </div>
        <span className="spacer" />
        <span className="pool-note" style={{ maxWidth: 380 }}>
          Cuando ambos capitanes confirman, se abre la ventana de comodines y arranca la partida. Si el admin re-abre el lineup tras un ANULAR, volvés a declararlo acá.
        </span>
      </div>
    </div>
  );
}

/** Caso donde el formato no requiere elegir jugadores (3v3/FUSIÓN): solo READY #2. */
function LineupReadyOnly({ matchId, readyLineup }: { matchId: string; readyLineup: boolean }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(readyLineup);
  const [err, setErr] = useState<string | null>(null);
  if (done) return <span className="text-sm text-[var(--vertigo-success)]"> ✓ READY confirmado</span>;
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        className="vertigo-btn vertigo-btn-primary"
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            try {
              const fd = new FormData();
              fd.set("match_id", matchId);
              await confirmLineupReadyFormAction(fd);
              setDone(true);
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Error");
            }
          });
        }}
      >
        {pending ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <CheckCircle2 style={{ width: 14, height: 14 }} />}
        Confirmar READY
      </button>
      {err && <div className="mt-2 text-sm text-[var(--vertigo-danger)]">{err}</div>}
    </div>
  );
}

// ============================================================
// Prompt de ventana de comodines — grilla 2×2 estilo demo
// ============================================================

const REROLL_PHASES = ["MODO", "ANTIMETA", "FORMATO", "MAPA", "CIVS"] as const;

/** Reloj vivo de la ventana: mm:ss, rojo al último minuto, "cerró" al expirar. */
function WindowTimer({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const expires = expiresAt ? new Date(expiresAt).getTime() : null;
  if (expires === null) return null;
  const left = Math.max(0, expires - now);
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const expired = left <= 0;
  const urgent = !expired && left <= 60_000;
  return (
    <span className={`window-timer ${expired ? "expired" : urgent ? "urgent" : ""}`}>
      <Clock style={{ width: 15, height: 15 }} />
      {expired ? "Cerró" : `Cierra en ${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`}
    </span>
  );
}

function ComodinPrompt({
  phaseCls,
  matchId,
  comodinExpiresAt,
  myTeamName,
  rivalTeamName,
  rivalPlayers,
  rivalAnnulled,
  playerMode,
  comodinInventory,
  myTeamRegId,
  comodinUsages,
}: {
  phaseCls: string;
  matchId: string;
  comodinExpiresAt: string | null;
  myTeamName: string;
  rivalTeamName: string;
  rivalPlayers: PlayerLite[];
  rivalAnnulled: string[];
  playerMode: string | null;
  comodinInventory: ComodinInventoryLite;
  myTeamRegId: string;
  comodinUsages: { comodinType: string; status: string; teamRegId: string | null }[];
}) {
  const pendingCls = "vertigo-card";
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [comodinOpen, setComodinOpen] = useState<null | "reroll" | "anular" | "elegir_rival">(null);
  const [targetPhase, setTargetPhase] = useState<string | null>(null);
  const [targetPlayer, setTargetPlayer] = useState<string | null>(null);

  // Exclusión mutua anular↔elegir_rival por llave — MISMA regla que el server
  // (match-day.ts): existe un uso de MI equipo del otro tipo con status fuera
  // de {cancelled, revoked} → el opuesto queda bloqueado (pending también cuenta:
  // apenas lo solicitás, el server ya lo rechazaría).
  const usedTypes = new Set(
    comodinUsages
      .filter((u) => u.teamRegId === myTeamRegId && u.status !== "cancelled" && u.status !== "revoked")
      .map((u) => u.comodinType)
  );
  const anularLocked = usedTypes.has("elegir_rival");
  const elegirLocked = usedTypes.has("anular");

  const isMsgError = msg ? (msg.includes("✗") || msg.toLowerCase().includes("error") || msg.toLowerCase().startsWith("no ")) : false;

  const request = (type: string) => {
    setMsg(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        const gameId = await fetchCurrentGameId(matchId);
        fd.set("match_id", matchId);
        if (gameId) fd.set("match_game_id", gameId);
        fd.set("comodin_type", type);
        if (type === "reroll" && targetPhase) {
          fd.set("target_phase", targetPhase);
          fd.set("notes", `Re-girar fase ${targetPhase}`);
        }
        if ((type === "anular" || type === "elegir_rival") && targetPlayer) {
          fd.set("target_player_id", targetPlayer);
          const p = rivalPlayers.find((r) => r.id === targetPlayer);
          fd.set("notes", `${type === "anular" ? "Anular" : "Elegir rival"}: ${p?.display_name ?? targetPlayer}`);
        }
        await useComodinFormAction(fd);
        setMsg("✓ ¡Comodín usado! El efecto ya está aplicado y salió en el stream.");
        setComodinOpen(null);
        setTargetPhase(null);
        setTargetPlayer(null);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "No se pudo solicitar el comodín.");
      }
    });
  };

  const expired = (() => {
    if (!comodinExpiresAt) return false;
    return new Date(comodinExpiresAt).getTime() <= Date.now();
  })();

  return (
    <div className={`${pendingCls} ${phaseCls}`} style={{ border: "1px solid rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.05)" }}>
      <div className="vertigo-card-header" style={{ borderBottomColor: "rgba(251,191,36,0.25)" }}>
        <div className="vertigo-card-title" style={{ color: "#fbbf24" }}>
          <Sparkles style={{ width: 14, height: 14, display: "inline", marginRight: 8 }} />
          Ventana de comodines — {myTeamName}
        </div>
        <WindowTimer expiresAt={comodinExpiresAt} />
      </div>

      {expired ? (
        <div className="flex items-center gap-2 text-sm text-[var(--vertigo-success)]">
          <CheckCircle2 style={{ width: 16, height: 16 }} />
          La ventana de comodines cerró. El admin arranca la partida.
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--vertigo-muted)] mb-4 leading-relaxed">
            Usá tus comodines antes de que cierre la ventana — el efecto se aplica <strong style={{ color: "var(--vertigo-text)" }}>al instante</strong> y la carta sale en el stream.
            Recordá: <strong style={{ color: "var(--vertigo-text)" }}>Anular</strong> y <strong style={{ color: "var(--vertigo-text)" }}>Elegir rival</strong> son mutuamente excluyentes en esta llave.
          </p>
          <div className="comodin-grid">
            {/* RE-GIRAR */}
            <button
              type="button"
              className={`comodin-card ${comodinOpen === "reroll" ? "active" : ""}`}
              disabled={pending || comodinInventory.reroll <= 0}
              onClick={() => { setComodinOpen(comodinOpen === "reroll" ? null : "reroll"); setTargetPhase(null); }}
            >
              <span className="icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/icons/comodin-regirar.png" alt="" />
              </span>
              <span className="info">
                <span className="name">Re-girar una fase</span>
                <span className="sub">Vuelve a sortear el mapa, civs o el modo</span>
              </span>
              <span className="qty">{comodinInventory.reroll > 0 ? `×${comodinInventory.reroll}` : "—"}</span>
            </button>

            {/* Sub-selector de RE-GIRAR: banda central de la grilla */}
            {comodinOpen === "reroll" && (
              <div className="comodin-target">
                <div className="q">¿Qué fase querés re-girar?</div>
                <div className="target-options">
                  {REROLL_PHASES.map((phase) => (
                    <button
                      key={phase}
                      type="button"
                      className={`target-chip ${targetPhase === phase ? "chosen" : ""}`}
                      onClick={() => setTargetPhase(phase)}
                    >
                      {phase.charAt(0) + phase.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!targetPhase || pending}
                  onClick={() => request("reroll")}
                  className="vertigo-btn vertigo-btn-primary self-start"
                  style={{ fontSize: 11, padding: "9px 18px" }}
                >
                  {pending ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 12, height: 12 }} />}
                  Usar RE-GIRAR {targetPhase ?? ""}
                </button>
              </div>
            )}

            {/* ANULAR — solo si el modo tiene lineup individual */}
            {playerMode !== "3v3" && playerMode !== "fusion" && (
              <button
                type="button"
                className={`comodin-card ${comodinOpen === "anular" ? "active" : ""} ${comodinInventory.anular <= 0 || anularLocked ? "used" : ""}`}
                disabled={pending || comodinInventory.anular <= 0 || anularLocked}
                onClick={() => { setComodinOpen(comodinOpen === "anular" ? null : "anular"); setTargetPlayer(null); }}
              >
                <span className="icon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/icons/comodin-anular.png" alt="" />
                </span>
                <span className="info">
                  <span className="name">Anular jugador rival</span>
                  <span className="sub">
                    {anularLocked
                      ? "Ya usaste ELEGIR RIVAL en esta llave"
                      : comodinInventory.anular > 0
                      ? `Un jugador de ${rivalTeamName} no puede jugar`
                      : "No te quedan usos"}
                  </span>
                </span>
                <span className="qty">{comodinInventory.anular > 0 ? `×${comodinInventory.anular}` : "—"}</span>
              </button>
            )}

            {/* Sub-selector de ANULAR */}
            {comodinOpen === "anular" && (
              <div className="comodin-target">
                <div className="q">¿Qué jugador de {rivalTeamName} NO puede jugar esta llave?</div>
                <div className="target-options">
                  {rivalPlayers.map((p) => {
                    const isAnnulled = rivalAnnulled.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`target-chip ${targetPlayer === p.id ? "chosen" : ""}`}
                        disabled={isAnnulled || pending}
                        onClick={() => setTargetPlayer(p.id)}
                      >
                        {p.is_captain ? "★ " : ""}{p.display_name}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={!targetPlayer || pending}
                  onClick={() => request("anular")}
                  className="vertigo-btn vertigo-btn-primary self-start"
                  style={{ fontSize: 11, padding: "9px 18px" }}
                >
                  {pending ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 12, height: 12 }} />}
                  Usar ANULAR
                </button>
              </div>
            )}

            {/* ELEGIR RIVAL — deshabilitado si ya usaste ANULAR (exclusión mutua) */}
            {playerMode !== "3v3" && playerMode !== "fusion" && (
              <button
                type="button"
                className={`comodin-card ${comodinOpen === "elegir_rival" ? "active" : ""} ${comodinInventory.elegirRival <= 0 || elegirLocked ? "used" : ""}`}
                disabled={pending || comodinInventory.elegirRival <= 0 || elegirLocked}
                onClick={() => { setComodinOpen(comodinOpen === "elegir_rival" ? null : "elegir_rival"); setTargetPlayer(null); }}
              >
                <span className="icon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/icons/comodin-elegir.png" alt="" />
                </span>
                <span className="info">
                  <span className="name">Elegir rival forzado</span>
                  <span className="sub">
                    {elegirLocked
                      ? "Ya usaste ANULAR en esta llave"
                      : comodinInventory.elegirRival > 0
                      ? `Un jugador de ${rivalTeamName} DEBE jugar`
                      : "No te quedan usos"}
                  </span>
                </span>
                <span className="qty">{comodinInventory.elegirRival > 0 ? `×${comodinInventory.elegirRival}` : "—"}</span>
              </button>
            )}

            {/* Sub-selector de ELEGIR RIVAL */}
            {comodinOpen === "elegir_rival" && (
              <div className="comodin-target">
                <div className="q">¿Qué jugador de {rivalTeamName} DEBE jugar esta llave?</div>
                <div className="target-options">
                  {rivalPlayers.map((p) => {
                    const isAnnulled = rivalAnnulled.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`target-chip ${targetPlayer === p.id ? "chosen" : ""}`}
                        disabled={isAnnulled || pending}
                        onClick={() => setTargetPlayer(p.id)}
                      >
                        {p.is_captain ? "★ " : ""}{p.display_name}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={!targetPlayer || pending}
                  onClick={() => request("elegir_rival")}
                  className="vertigo-btn vertigo-btn-primary self-start"
                  style={{ fontSize: 11, padding: "9px 18px" }}
                >
                  {pending ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 12, height: 12 }} />}
                  Usar ELEGIR RIVAL
                </button>
              </div>
            )}

            {/* INVOCAR PRO: informativo — se activa con CARTA PRO en el chat */}
            <div className="comodin-card used" style={{ cursor: "default" }} aria-label="Invocar PRO">
              <span className="icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/icons/comodin-invocar.png" alt="" />
              </span>
              <span className="info">
                <span className="name">Invocar PRO</span>
                <span className="sub">
                  Se usa <strong style={{ color: "var(--vertigo-muted)" }}>durante la partida</strong>, no en esta ventana. Escribí{" "}
                  <strong style={{ color: "var(--vertigo-muted)" }}>“CARTA PRO”</strong> en el chat del sitio.
                </span>
              </span>
              <span className="qty">{comodinInventory.invocarPro > 0 ? `×${comodinInventory.invocarPro}` : "—"}</span>
            </div>
          </div>
        </>
      )}
      {msg && <div className="mt-3 text-sm" style={{ color: isMsgError ? "var(--vertigo-danger)" : "var(--vertigo-success)" }}>{msg}</div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ============================================================
// Helper client-side: resolver el match_game_id actual del match
// ============================================================
async function fetchCurrentGameId(matchId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseBrowser() as any;
    const { data } = await supabase
      .from("match_game")
      .select("id")
      .eq("match_id", matchId)
      .in("status", ["drawing", "lineup", "comodin_window"])
      .order("game_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
    const { data: fallback } = await supabase
      .from("match_game")
      .select("id")
      .eq("match_id", matchId)
      .order("game_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    return fallback?.id ?? null;
  } catch {
    return null;
  }
}

/** Cuántos jugadores juegan según el formato. 0 = todo el equipo (no hay elección). */
function playersForMode(mode: string | null): number {
  switch (mode) {
    case "1v1": return 1;
    case "2v2": return 2;
    case "3v3":
    case "fusion":
      return 0;
    default: return 0;
  }
}

/** Chips de civs sorteadas para el equipo del capitán (bloque drawing). */
function MyCivChips({ myCivs, label }: { myCivs: string[]; label: string }) {
  if (!myCivs || myCivs.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest text-[var(--vertigo-faint)]">{label}</span>
      {myCivs.map((civ) => (
        <span
          key={civ}
          className="vertigo-badge vertigo-badge-purple"
          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/civs/${civ}.webp`} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
          {civName(civ)}
        </span>
      ))}
    </div>
  );
}
