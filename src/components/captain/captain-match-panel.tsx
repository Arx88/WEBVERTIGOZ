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
  annulledPlayerIds: string[];
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
  /** Jugadores ya anulados en este match (por comodín ANULAR) */
  annulledPlayerIds: string[];
  readyA: boolean;
  readyB: boolean;
  readyLineupA: boolean;
  readyLineupB: boolean;
  format: string | null;
  scheduledAtStart: string | null;
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
  annulledPlayerIds,
  readyA,
  readyB,
  readyLineupA,
  readyLineupB,
  format,
  scheduledAtStart,
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

  // Countdown al inicio
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const start = scheduledAtStart ? new Date(scheduledAtStart).getTime() : null;
  const timeToStart = start ? start - now : null;

  // Cherry-pick: el READY #1 lo hace confirmReadyAction (existe).
  // Acá solo lo mostramos/contextualizamos. El botón real ya está en /mis-partidos.

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
          El sorteo definió el modo y el formato. Declará <strong style={{ color: "var(--vertigo-text)" }}>quién juega</strong> esta partida
          y confirmá READY. Cuando ambos equipos lo hagan, abre la ventana de comodines (5 min).
        </p>
        <CaptainLineupForm
          matchId={matchId}
          myPlayers={myPlayers}
          annulledPlayerIds={annulledPlayerIds}
          playerModeExpected={format}
          readyLineup={myReadyLineup}
          pending={pending}
          onSubmit={(playerIds) => {
            setError(null); setSuccessMsg(null);
            startTransition(async () => {
              try {
                const fd = new FormData();
                // Necesitamos el match_game_id — lo resolvemos acá
                const gameId = await fetchCurrentGameId(matchId);
                if (!gameId) throw new Error("No se encontró la partida en curso.");
                fd.set("match_game_id", gameId);
                fd.set("player_ids", JSON.stringify(playerIds));
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
    return <ComodinPrompt matchId={matchId} comodinExpiresAt={comodinExpiresAt} myTeamName={myTeam?.name ?? "Tu equipo"} />;
  }

  // ===== Esperando sorteo / partido en curso — contexto para el capitán
  return (
    <div className={panelClasses}>
      <div className="vertigo-card-header">
        <div className="vertigo-card-title">
          <Sword style={{ width: 14, height: 14, display: "inline", marginRight: 8, color: "var(--vertigo-purple-soft)" }} />
          Tu partido — {myTeam?.name}
        </div>
        <span className="vertigo-badge vertigo-badge-purple">{status}</span>
      </div>

      {/* Countdown al inicio */}
      {timeToStart !== null && timeToStart > 0 && (
        <div className="flex items-center gap-3 mb-4 p-4 rounded-lg" style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <Timer style={{ width: 20, height: 20, color: "var(--vertigo-purple-soft)" }} />
          <div>
            <div className="text-sm font-semibold text-[var(--vertigo-text)]">
              Comienza en {new Date(timeToStart).toISOString().slice(11, 19)}
            </div>
            <div className="text-[12px] text-[var(--vertigo-faint)]">
              La ruleta gira 15 min antes del horario. Avisá a tu equipo.
            </div>
          </div>
        </div>
      )}

      {/* READY #1 status */}
      {status === "scheduled" && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-[var(--vertigo-muted)]">
            {myReady
              ? (rivalReady ? "✓ Ambos equipos listos. Aguardando al admin para el sorteo." : "✓ Estás listo. Esperando al rival.")
              : "Confirmá tu asistencia para habilitar la llave."}
          </div>
        </div>
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
  readyLineup,
  pending,
  onSubmit,
}: {
  matchId: string;
  myPlayers: PlayerLite[];
  annulledPlayerIds: string[];
  playerModeExpected: string | null;
  readyLineup: boolean;
  pending: boolean;
  onSubmit: (playerIds: string[]) => void;
}) {
  const available = myPlayers.filter((p) => !annulledPlayerIds.includes(p.id));
  const expected = playersForMode(playerModeExpected);
  const [selected, setSelected] = useState<string[]>(available.slice(0, expected).map((p) => p.id));

  useEffect(() => {
    setSelected((cur) => cur.filter((id) => !annulledPlayerIds.includes(id)));
  }, [annulledPlayerIds]);

  const toggle = (id: string) => {
    setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < expected ? [...cur, id] : cur);
  };

  if (expected === 0) {
    return (
      <div className="text-sm text-[var(--vertigo-muted)] italic">
        Modo 3v3 o FUSIÓN: juega todo el equipo, no hay lineup que declarar. Confirmá READY abajo.
        <LineupReadyOnly matchId={matchId} readyLineup={readyLineup} />
      </div>
    );
  }

  return (
    <div>
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-[12px] text-[var(--vertigo-faint)]">
          Seleccionados: <strong className="text-[var(--vertigo-purple-pale)]">{selected.length} / {expected}</strong>
        </span>
        {!readyLineup ? (
          <button
            type="button"
            disabled={selected.length !== expected || pending}
            onClick={() => onSubmit(selected)}
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

function ComodinPrompt({ matchId, comodinExpiresAt, myTeamName }: { matchId: string; comodinExpiresAt: string | null; myTeamName: string }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const expires = comodinExpiresAt ? new Date(comodinExpiresAt).getTime() : null;
  const left = expires ? Math.max(0, expires - now) : null;
  const mm = left !== null ? Math.floor(left / 60000) : null;
  const ss = left !== null ? Math.floor((left % 60000) / 1000) : null;
  const pendingCls = "vertigo-card";
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const request = (type: string, label: string) => {
    setMsg(null);
    startTransition(async () => {
      try {
        // Necesitamos el match_game_id actual — lo resolvemos
        const fd = new FormData();
        const gameId = await fetchCurrentGameId(matchId);
        fd.set("match_id", matchId);
        if (gameId) fd.set("match_game_id", gameId);
        fd.set("comodin_type", type);
        await requestComodinFormAction(fd);
        setMsg(`${label} solicitado — el admin lo ejecuta en segundos.`);
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
          <span className="vertigo-badge vertigo-badge-warning" style={{ fontFamily: "Cinzel, serif", fontSize: 14 }}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--vertigo-muted)] mb-4 leading-relaxed">
        Podés usar tus comodines. El admin ejecuta cada uno en vivo (para que se vea en el stream).
        Recordá: <strong style={{ color: "var(--vertigo-text)" }}>Anular</strong> y <strong style={{ color: "var(--vertigo-text)" }}>Elegir rival</strong> son mutuamente excluyentes en esta llave.
      </p>
      <div className="flex flex-wrap gap-2">
        <ComodinButton label="Re-girar una fase" pending={pending} onClick={() => request("reroll", "Re-girar")} />
        <ComodinButton label="Anular jugador rival" pending={pending} onClick={() => request("anular", "Anular")} />
        <ComodinButton label="Elegir rival forzado" pending={pending} onClick={() => request("elegir_rival", "Elegir rival")} />
        <ComodinButton label="Invocar PRO" pending={pending} onClick={() => request("invocar_pro", "Invocar PRO")} />
      </div>
      {msg && <div className="mt-3 text-sm" style={{ color: msg.includes("✗") || msg.toLowerCase().includes("error") || msg.toLowerCase().includes("no") ? "var(--vertigo-danger)" : "var(--vertigo-success)" }}>{msg}</div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ComodinButton({ label, pending, onClick }: { label: string; pending: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={pending} onClick={onClick} className="vertigo-btn vertigo-btn-ghost" style={{ padding: "10px 16px", fontSize: 11 }}>
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
