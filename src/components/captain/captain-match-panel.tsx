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
import {
  confirmReadyAction,
} from "@/server/actions/ready";
import {
  declareLineupFormAction,
  confirmLineupReadyFormAction,
  requestComodinFormAction,
} from "@/server/actions/match-day";
import {
  CheckCircle2, Users, Sword, Timer, Sparkles, Loader2, AlertCircle,
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
}

interface Props {
  matchId: string;
  status: string;
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
  readyA: boolean;
  readyB: boolean;
  readyLineupA: boolean;
  readyLineupB: boolean;
  /** player_mode de la partida activa (1v1/2v2/3v3/fusion) — define cuántos juegan.
      NO es lo mismo que match.format (que es BO3/BO1). */
  playerMode: string | null;
  /** Civs sorteadas para MI equipo en la partida activa (pool para asignar). */
  myCivs: string[];
  /** comodin_window_expires_at */
  comodinExpiresAt: string | null;
}

export function CaptainMatchPanel({
  matchId,
  status,
  myTeamRegId,
  teamA,
  teamB,
  myPlayers,
  rivalPlayers,
  annulledPlayerIds,
  rivalAnnulledPlayerIds,
  readyA,
  readyB,
  readyLineupA,
  readyLineupB,
  playerMode,
  myCivs,
  comodinExpiresAt,
}: Props) {
  const isMyTeamA = myTeamRegId === teamA?.id;
  const myTeam = isMyTeamA ? teamA : teamB;
  const myReady = isMyTeamA ? readyA : readyB;
  const myReadyLineup = isMyTeamA ? readyLineupA : readyLineupB;
  const rivalReady = isMyTeamA ? readyB : readyA;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const panelClasses = "vertigo-card";
  const isCaptainOfThisMatch = !!myTeamRegId;

  if (!isCaptainOfThisMatch) return null;

  // ===== READY #2 view (declarar lineup + confirmar)
  if (status === "lineup") {
    return (
      <div className={panelClasses} style={{ border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.04)" }}>
        <div className="vertigo-card-header" style={{ borderBottomColor: "rgba(251,191,36,0.2)" }}>
          <div className="vertigo-card-title" style={{ color: "#fbbf24" }}>
            <Users style={{ width: 14, height: 14, display: "inline", marginRight: 8 }} />
            Declarar lineup de {myTeam?.name ?? "tu equipo"}
          </div>
          <span className="vertigo-badge vertigo-badge-warning">LINEUP</span>
        </div>
        <p className="text-sm text-[var(--vertigo-muted)] mb-4 leading-relaxed">
          El sorteo definió el modo y el formato. Declará <strong style={{ color: "var(--vertigo-text)" }}>quién juega</strong> esta partida,
          asigná <strong style={{ color: "var(--vertigo-text)" }}>una civ sorteada a cada jugador</strong> y confirmá READY.
          Cuando ambos equipos lo hagan, abre la ventana de comodines (5 min).
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
        {error && <div className="mt-3 text-sm text-[var(--vertigo-danger)] flex items-center gap-2"><AlertCircle style={{ width: 14, height: 14 }} />{error}</div>}
        {successMsg && <div className="mt-3 text-sm text-[var(--vertigo-success)]">{successMsg}</div>}
      </div>
    );
  }

  // ===== Ventana de comodines
  if (status === "comodin_window") {
    return <ComodinPrompt matchId={matchId} comodinExpiresAt={comodinExpiresAt} myTeamName={myTeam?.name ?? "Tu equipo"} rivalTeamName={!isMyTeamA ? teamA?.name ?? "Rival" : teamB?.name ?? "Rival"} rivalPlayers={rivalPlayers} rivalAnnulled={rivalAnnulledPlayerIds} playerMode={playerMode} />;
  }

  // ===== Esperando sorteo / partido en curso — contexto para el capitán.
  // El countdown y el estado ya viven en el bloque VERSUS (abajo); este panel
  // es la ACCIÓN del capitán: READY #1 para habilitar la llave.
  const waitingStart = status === "scheduled" || status === "open";
  return (
    <div className={panelClasses}>
      <div className="vertigo-card-header">
        <div className="vertigo-card-title">
          <Sword style={{ width: 14, height: 14, display: "inline", marginRight: 8, color: "var(--vertigo-purple-soft)" }} />
          Tu partido — {myTeam?.name}
        </div>
        {waitingStart && myReady && rivalReady && (
          <span className="vertigo-badge vertigo-badge-success">LLAVE HABILITADA</span>
        )}
      </div>

      {/* READY #1: confirmar asistencia para habilitar la llave */}
      {waitingStart && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-[var(--vertigo-muted)]">
              {myReady
                ? (rivalReady ? "✓ Ambos equipos listos. Aguardando al admin para el sorteo." : "✓ Estás listo. Esperando al rival.")
                : "Confirmá tu asistencia para habilitar la llave."}
            </div>
            {!myReady && (
              <form action={confirmReadyAction.bind(null, matchId)}>
                <button type="submit" className="vertigo-btn vertigo-btn-success" style={{ fontSize: 11, padding: "10px 20px" }}>
                  <CheckCircle2 style={{ width: 14, height: 14 }} />
                  ESTOY LISTO
                </button>
              </form>
            )}
          </div>
          <div className="text-[12px] text-[var(--vertigo-faint)] mt-3 flex items-center gap-2">
            <Timer style={{ width: 12, height: 12, flexShrink: 0 }} />
            La ruleta gira 15 min antes del horario. Avisá a tu equipo.
          </div>
        </>
      )}
      {status === "drawing" && (
        <div className="text-sm text-[var(--vertigo-purple-soft)]">◆ La ruleta está girando. El resultado aparece acá apenas termina.</div>
      )}
      {status === "in_progress" && (
        <div className="text-sm text-[var(--vertigo-success)]">▶ Partida en juego. ¡A ganar!</div>
      )}
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
  const [selected, setSelected] = useState<string[]>(available.slice(0, expected).map((p) => p.id));
  // player_id → civ_id. Cada jugador seleccionado elige UNA civ del pool.
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [civError, setCivError] = useState<string | null>(null);

  useEffect(() => {
    setSelected((cur) => cur.filter((id) => !annulledPlayerIds.includes(id)));
  }, [annulledPlayerIds]);

  const toggle = (id: string) => {
    setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < expected ? [...cur, id] : cur);
    setCivError(null);
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
    <div>
      {/* Selección de jugadores */}
      <div className="text-[10px] uppercase tracking-widest text-[var(--vertigo-faint)] mb-2">1 · Elegí quién juega ({expected})</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {myPlayers.map((p) => {
          const isSelected = selected.includes(p.id);
          const isAnnulled = annulledPlayerIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={isAnnulled || pending || readyLineup}
              onClick={() => toggle(p.id)}
              className="vertigo-btn"
              style={{
                padding: "10px 16px",
                fontSize: 12,
                background: isSelected ? "rgba(124,58,237,0.18)" : "transparent",
                border: `1px solid ${isAnnulled ? "var(--vertigo-border)" : isSelected ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                color: isAnnulled ? "var(--vertigo-faint)" : isSelected ? "var(--vertigo-purple-pale)" : "var(--vertigo-muted)",
                opacity: isAnnulled ? 0.45 : 1,
                textDecoration: isAnnulled ? "line-through" : "none",
              }}
            >
              {p.is_captain ? "★ " : ""}{p.display_name}
              {isAnnulled && " (anulado)"}
            </button>
          );
        })}
      </div>

      {/* Paso a paso: si hay jugadores seleccionados, mostrar el selector de civs */}
      {selected.length > 0 && myCivs.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-widest text-[var(--vertigo-faint)] mb-2 mt-4">2 · Asigná una civ a cada jugador</div>
          <div className="flex flex-col gap-3 mb-4">
            {selected.map((pid) => {
              const player = myPlayers.find((p) => p.id === pid);
              const currentCiv = assign[pid] ?? null;
              return (
                <div key={pid} className="vertigo-info-card" style={{ padding: "12px 14px" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-semibold text-[var(--vertigo-text)]">{player?.display_name ?? pid.slice(0, 8)}</span>
                    {currentCiv && (
                      <span className="vertigo-badge vertigo-badge-purple" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <img src={`/civs/${currentCiv}.webp`} alt="" style={{ width: 14, height: 14, objectFit: "contain" }} />
                        {civName(currentCiv)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {myCivs.map((civ) => {
                      const taken = usedCivs.has(civ) && assign[pid] !== civ;
                      const chosen = assign[pid] === civ;
                      return (
                        <button
                          key={civ}
                          type="button"
                          disabled={taken || pending || readyLineup}
                          onClick={() => { setCivError(null); setAssign((cur) => ({ ...cur, [pid]: civ })); }}
                          className="vertigo-btn"
                          style={{
                            padding: "6px 10px",
                            fontSize: 11,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: chosen ? "rgba(124,58,237,0.2)" : taken ? "rgba(255,255,255,0.02)" : "transparent",
                            border: `1px solid ${chosen ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                            color: chosen ? "var(--vertigo-purple-pale)" : taken ? "var(--vertigo-faint)" : "var(--vertigo-muted)",
                            opacity: taken ? 0.35 : 1,
                            cursor: taken ? "not-allowed" : "pointer",
                          }}
                          title={taken ? "Civ ya asignada" : undefined}
                        >
                          <img src={`/civs/${civ}.webp`} alt="" style={{ width: 16, height: 16, objectFit: "contain", opacity: taken ? 0.3 : 1 }} />
                          {civName(civ)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {civError && <div className="text-[13px] text-[var(--vertigo-danger)] mb-3">{civError}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-[12px] text-[var(--vertigo-faint)]">
          Seleccionados: <strong className="text-[var(--vertigo-purple-pale)]">{selected.length} / {expected}</strong>
          {selected.length > 0 && myCivs.length > 0 && (
            <span className="ml-2">· Civs asignadas: <strong className="text-[var(--vertigo-purple-pale)]">{Object.keys(assign).filter((pid) => selected.includes(pid) && assign[pid]).length} / {selected.length}</strong></span>
          )}
        </span>
        {!readyLineup ? (
          <button
            type="button"
            disabled={selected.length !== expected || pending || (myCivs.length > 0 && !allAssignmentsDone)}
            onClick={handleConfirm}
            className="vertigo-btn vertigo-btn-primary"
          >
            {pending ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <CheckCircle2 style={{ width: 14, height: 14 }} />}
            Declarar lineup + READY
          </button>
        ) : (
          <span className="text-sm text-[var(--vertigo-success)]">✓ Lineup declarado</span>
        )}
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
// Prompt de ventana de comodines
// ============================================================

const REROLL_PHASES = ["MODO", "ANTIMETA", "FORMATO", "MAPA", "CIVS"] as const;

function ComodinPrompt({ matchId, comodinExpiresAt, myTeamName, rivalTeamName, rivalPlayers, rivalAnnulled, playerMode }: { matchId: string; comodinExpiresAt: string | null; myTeamName: string; rivalTeamName: string; rivalPlayers: PlayerLite[]; rivalAnnulled: string[]; playerMode: string | null }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const expires = comodinExpiresAt ? new Date(comodinExpiresAt).getTime() : null;
  const left = expires ? Math.max(0, expires - now) : null;
  const mm = left !== null ? Math.floor(left / 60000) : null;
  const ss = left !== null ? Math.floor((left % 60000) / 1000) : null;
  const expired = left !== null && left <= 0;
  const pendingCls = "vertigo-card";
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [comodinOpen, setComodinOpen] = useState<null | "reroll" | "anular" | "elegir_rival">(null);
  const [targetPhase, setTargetPhase] = useState<string | null>(null);
  const [targetPlayer, setTargetPlayer] = useState<string | null>(null);

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
        await requestComodinFormAction(fd);
        setMsg("✓ Comodín solicitado — el admin lo ejecuta en vivo.");
        setComodinOpen(null);
        setTargetPhase(null);
        setTargetPlayer(null);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "No se pudo solicitar el comodín.");
      }
    });
  };

  return (
    <div className={pendingCls} style={{ border: "1px solid rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.05)" }}>
      <div className="vertigo-card-header" style={{ borderBottomColor: "rgba(251,191,36,0.25)" }}>
        <div className="vertigo-card-title" style={{ color: "#fbbf24" }}>
          <Sparkles style={{ width: 14, height: 14, display: "inline", marginRight: 8 }} />
          Ventana de comodines — {myTeamName}
        </div>
        {left !== null && (
          <span className="vertigo-badge vertigo-badge-warning" style={{ fontFamily: "Cinzel, serif", fontSize: 14, color: expired ? "var(--vertigo-danger)" : undefined }}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
        )}
      </div>

      {expired ? (
        <div className="flex items-center gap-2 text-sm text-[var(--vertigo-success)]">
          <CheckCircle2 style={{ width: 16, height: 16 }} />
          La ventana de comodines cerró. El admin arranca la partida.
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--vertigo-muted)] mb-4 leading-relaxed">
            Podés usar tus comodines. El admin ejecuta cada uno en vivo (para que se vea en el stream).
            Recordá: <strong style={{ color: "var(--vertigo-text)" }}>Anular</strong> y <strong style={{ color: "var(--vertigo-text)" }}>Elegir rival</strong> son mutuamente excluyentes en esta llave.
          </p>
          <div className="flex flex-wrap gap-2">
            <ComodinButton label="Re-girar una fase" active={comodinOpen === "reroll"} pending={pending} onClick={() => setComodinOpen(comodinOpen === "reroll" ? null : "reroll")} />
            {playerMode !== "3v3" && playerMode !== "fusion" && (
              <>
                <ComodinButton label="Anular jugador rival" active={comodinOpen === "anular"} pending={pending} onClick={() => setComodinOpen(comodinOpen === "anular" ? null : "anular")} />
                <ComodinButton label="Elegir rival forzado" active={comodinOpen === "elegir_rival"} pending={pending} onClick={() => setComodinOpen(comodinOpen === "elegir_rival" ? null : "elegir_rival")} />
              </>
            )}
          </div>

          {/* RE-GIRAR: elegir la fase */}
          {comodinOpen === "reroll" && (
            <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.25)" }}>
              <div className="text-[10px] uppercase tracking-widest text-[var(--vertigo-faint)] mb-2">¿Qué fase querés re-girar?</div>
              <div className="flex flex-wrap gap-2">
                {REROLL_PHASES.map((phase) => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => setTargetPhase(phase)}
                    className="vertigo-btn"
                    style={{
                      padding: "8px 14px",
                      fontSize: 11,
                      background: targetPhase === phase ? "rgba(124,58,237,0.2)" : "transparent",
                      border: `1px solid ${targetPhase === phase ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                      color: targetPhase === phase ? "var(--vertigo-purple-pale)" : "var(--vertigo-muted)",
                    }}
                  >
                    {phase}
                  </button>
                ))}
              </div>
              <button type="button" disabled={!targetPhase || pending} onClick={() => request("reroll")} className="vertigo-btn vertigo-btn-primary mt-3" style={{ fontSize: 11, padding: "9px 18px" }}>
                {pending ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 12, height: 12 }} />}
                Solicitar RE-GIRAR {targetPhase ?? ""}
              </button>
            </div>
          )}

          {/* ANULAR / ELEGIR RIVAL: elegir jugador del rival */}
          {(comodinOpen === "anular" || comodinOpen === "elegir_rival") && (
            <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.25)" }}>
              <div className="text-[10px] uppercase tracking-widest text-[var(--vertigo-faint)] mb-2">
                {comodinOpen === "anular"
                  ? `¿Qué jugador de ${rivalTeamName} NO puede jugar esta llave?`
                  : `¿Qué jugador de ${rivalTeamName} DEBE jugar esta llave?`}
              </div>
              <div className="flex flex-wrap gap-2">
                {rivalPlayers.map((p) => {
                  const isAnnulled = rivalAnnulled.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isAnnulled || pending}
                      onClick={() => setTargetPlayer(p.id)}
                      className="vertigo-btn"
                      style={{
                        padding: "8px 14px",
                        fontSize: 11,
                        background: targetPlayer === p.id ? "rgba(124,58,237,0.2)" : "transparent",
                        border: `1px solid ${targetPlayer === p.id ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                        color: targetPlayer === p.id ? "var(--vertigo-purple-pale)" : "var(--vertigo-muted)",
                        opacity: isAnnulled ? 0.4 : 1,
                        textDecoration: isAnnulled ? "line-through" : "none",
                      }}
                    >
                      {p.is_captain ? "★ " : ""}{p.display_name}{isAnnulled ? " (anulado)" : ""}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={!targetPlayer || pending}
                onClick={() => request(comodinOpen)}
                className="vertigo-btn vertigo-btn-primary mt-3"
                style={{ fontSize: 11, padding: "9px 18px" }}
              >
                {pending ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 12, height: 12 }} />}
                Solicitar {comodinOpen === "anular" ? "ANULAR" : "ELEGIR RIVAL"}
              </button>
            </div>
          )}

          {/* INVOCAR PRO no se usa en la ventana: se invoca durante la partida */}
          <div className="text-[11px] text-[var(--vertigo-faint)] mt-4 pt-3 border-t border-[var(--vertigo-line-soft)]">
            <strong style={{ color: "var(--vertigo-muted)" }}>INVOCAR PRO</strong> se usa DURANTE la partida: escribí “CARTA PRO” en el chat del sitio.
          </div>
        </>
      )}
      {msg && <div className="mt-3 text-sm" style={{ color: isMsgError ? "var(--vertigo-danger)" : "var(--vertigo-success)" }}>{msg}</div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ComodinButton({ label, pending, active, onClick }: { label: string; pending: boolean; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="vertigo-btn vertigo-btn-ghost"
      style={{
        padding: "10px 16px",
        fontSize: 11,
        background: active ? "rgba(124,58,237,0.18)" : undefined,
        border: active ? "1px solid var(--vertigo-purple)" : undefined,
      }}
    >
      {pending ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 12, height: 12 }} />}
      {label}
    </button>
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
