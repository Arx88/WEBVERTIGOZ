"use client";

/**
 * Panel de apuestas del espectador, embebido en /partido/[id].
 *
 * Concepto: una BOLETA de apuesta, no un formulario.
 *  - El pick es un solo control partido en dos mitades (PickControl):
 *    tocar un lado lo enciende con la cuota en gigante y apaga el otro.
 *  - La boleta se va llenando: lado → monto → premio proyectado → confirmar.
 *  - Ya jugada, la misma boleta queda "estampada" con lo que cobrás si gana.
 *
 * Estados:
 *  - viewer anónimo → CTA de registro (no invasivo).
 *  - participante logueado (capitán / admin / caster) → no ve nada de apuestas:
 *    es público del torneo, no del pozo, y en modo por sortear su página de
 *    partido no debe invitarlo a registrarse como espectador.
 *  - llave apostable (scheduled + ambos equipos) sin apuesta → boleta vacía.
 *  - llave apostable con apuesta propia → boleta estampada + cancelar (reintegro).
 *  - llave abierta/cerrada → solo lectura; liquidada → resultado.
 *
 * El contexto (saldo, apuesta propia, agregados del pozo) lo resuelve el server
 * en page.tsx con service role. El status y los equipos llegan en vivo desde el
 * wrapper realtime, así el panel se cierra solo cuando la llave abre.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Ticket, Trophy, Lock, Undo2, XCircle, AlertTriangle, Flame, Users } from "lucide-react";
import { placeBetAction, cancelBetAction } from "@/server/actions/apuestas";
import CountdownBadge from "@/app/(public)/apuestas/countdown-badge";
import { BET_MAX_PAYOUT_MULT } from "@/lib/constants";

export interface SpectatorBetContext {
  accountId: string;
  balance: number;
  myBet: { id: string; pickedTeamId: string; stake: number; status: string; payout: number } | null;
  pool: number;
  stakeA: number;
  stakeB: number;
  bettors: number;
  /** Inicio agendado de la llave = cierre de apuestas. Para el countdown. */
  scheduledAtStart?: string | null;
}

export type BetPanelContext =
  | { kind: "anonymous" }
  | { kind: "other-role" }
  | ({ kind: "spectator" } & SpectatorBetContext);

interface TeamRef {
  id: string;
  name: string;
  seed?: number | null;
}

interface Props {
  context: BetPanelContext;
  matchId: string;
  /** Status en vivo del match (lo actualiza el canal realtime del wrapper) */
  status: string;
  teamA: TeamRef | null;
  teamB: TeamRef | null;
}

function fmt(n: number): string {
  return n.toLocaleString("es-AR");
}

/** Cuota pari-mutuel actual: pozo / apostado al equipo. */
function cuota(pool: number, stake: number): string {
  if (stake <= 0 || pool <= 0) return "—";
  return `×${(pool / stake).toFixed(2)}`;
}

/** Cuota proyectada si el viewer apuesta `stake` a ese equipo ahora. */
function cuotaProyectada(pool: number, stakeSide: number, stake: number): number | null {
  const newSide = stakeSide + stake;
  if (newSide <= 0) return null;
  return (pool + stake) / newSide;
}

/**
 * Barra de dinero A vs B + prueba social: dónde está poniendo la plata
 * la gente y cuántos ya apostaron.
 */
function PoolBar({
  pool,
  stakeA,
  stakeB,
  teamA,
  teamB,
  bettors,
}: {
  pool: number;
  stakeA: number;
  stakeB: number;
  teamA: TeamRef;
  teamB: TeamRef;
  bettors: number;
}) {
  const pctA = pool > 0 ? Math.round((stakeA / pool) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] mb-2">
        <Users style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)", flexShrink: 0 }} />
        {pool > 0 ? (
          <span style={{ color: "var(--vertigo-muted)" }}>
            Ya van <span className="font-bold text-[var(--vertigo-text)]">{fmt(pool)} pts</span> de{" "}
            <span className="font-bold text-[var(--vertigo-text)]">{bettors}</span>{" "}
            {bettors === 1 ? "apostador" : "apostadores"} en esta llave
          </span>
        ) : (
          <span style={{ color: "var(--vertigo-gold)" }}>
            <Flame style={{ width: 10, height: 10, display: "inline", marginRight: 4 }} />
            Sé el primero: la primera apuesta fija la cuota base
          </span>
        )}
      </div>
      <div className="flex h-[7px] rounded-full overflow-hidden" style={{ background: "var(--vertigo-line-soft)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pool > 0 ? pctA : 50}%`, background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
        />
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pool > 0 ? pctB : 50}%`, background: "linear-gradient(90deg, #D4AF37, #f0d878)" }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px]">
        <span style={{ color: "var(--vertigo-purple-soft)" }}>
          {pool > 0 ? `${pctA}% del pozo va a ${teamA.name}` : ""}
        </span>
        <span style={{ color: "var(--vertigo-gold)" }}>
          {pool > 0 ? `${pctB}% a ${teamB.name}` : ""}
        </span>
      </div>
    </div>
  );
}

export default function BetPanel({ context, matchId, status, teamA, teamB }: Props) {
  // Participantes logueados: cero UI de apuestas (ni siquiera el CTA de registro).
  if (context.kind === "other-role") return null;

  if (context.kind !== "spectator") {
    return (
      <div className="vertigo-card" style={{ padding: "20px 24px" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Coins style={{ width: 20, height: 20, color: "var(--vertigo-gold)", flexShrink: 0 }} strokeWidth={1.5} />
            <div className="min-w-0">
              <div className="text-[13px] text-[var(--vertigo-text)] font-semibold">Apuestas de espectadores</div>
              <div className="text-[11px] text-[var(--vertigo-faint)] mt-0.5">
                Registrate como espectador y recibí puntos para apostar en cada llave.
              </div>
            </div>
          </div>
          <Link
            href="/registro-espectador"
            className="vertigo-btn vertigo-btn-primary flex-none"
            style={{ padding: "8px 16px", fontSize: "11px" }}
          >
            Quiero apostar
          </Link>
        </div>
      </div>
    );
  }

  const bettable = status === "scheduled" && !!teamA && !!teamB;

  return (
    <div
      className="vertigo-card"
      style={{
        borderColor: "rgba(212,175,55,0.30)",
        boxShadow: "0 0 34px rgba(124,58,237,0.10)",
      }}
    >
      <div className="vertigo-card-header">
        <div className="vertigo-card-title">
          <Ticket style={{ width: 15, height: 15, display: "inline", marginRight: 8, color: "var(--vertigo-gold)" }} />
          Apuestas de esta llave
          {bettable && <span className="apu-live-dot apu-live-dot--gold" style={{ marginLeft: 8 }} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="vertigo-badge vertigo-badge-purple">
            <Coins style={{ width: 11, height: 11 }} />
            Saldo: {fmt(context.balance)}
          </span>
          {bettable && context.scheduledAtStart && (
            <CountdownBadge target={context.scheduledAtStart} />
          )}
          {!bettable && (
            <span className="vertigo-badge vertigo-badge-warning">
              <Lock style={{ width: 11, height: 11 }} />
              Cerrada
            </span>
          )}
        </div>
      </div>

      {bettable ? (
        context.myBet && context.myBet.status === "pending" ? (
          <MyPendingBet context={context} teamA={teamA!} teamB={teamB!} />
        ) : (
          <BetForm context={context} matchId={matchId} teamA={teamA!} teamB={teamB!} />
        )
      ) : status === "scheduled" && (!teamA || !teamB) ? (
        <div className="vertigo-empty" style={{ padding: "32px 24px" }}>
          <Ticket style={{ width: 36, height: 36, color: "var(--vertigo-faint)", margin: "0 auto 12px" }} strokeWidth={1} />
          <div className="vertigo-empty-title">Todavía sin equipos</div>
          <p className="vertigo-empty-desc">
            Esta llave se completa cuando avancen los ganadores de la ronda anterior. Vas a poder
            apostar cuando estén los dos equipos.
          </p>
        </div>
      ) : (
        <ClosedView context={context} status={status} teamA={teamA} teamB={teamB} />
      )}

      <div className="mt-4 pt-3 border-t border-[var(--vertigo-line-soft)] text-[10px] text-[var(--vertigo-faint)] leading-relaxed">
        Pari-mutuel: el pozo se reparte entre los que aciertan, proporcional al monto apostado.
        {bettable && " Podés cancelar tu boleta mientras la llave no abra (se devuelve el 75% del monto)."}
        {" "}Tope de pago: ×10 por boleta.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PickControl — el corazón de la boleta.
// Un solo control partido en dos mitades con la costura "VS".
// El lado elegido se enciende (gradiente violeta + cuota gigante
// brillando) y el otro se apaga. Sin onPick es solo lectura.
// ─────────────────────────────────────────────────────────────

function PickControl({
  pool,
  teamA,
  teamB,
  stakeA,
  stakeB,
  pickedId,
  onPick,
}: {
  pool: number;
  teamA: TeamRef;
  teamB: TeamRef;
  stakeA: number;
  stakeB: number;
  pickedId: string | null;
  onPick?: (teamId: string) => void;
}) {
  const sides = [
    { team: teamA, side: stakeA, first: true },
    { team: teamB, side: stakeB, first: false },
  ];

  return (
    <div
      className="relative grid grid-cols-2"
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(212,175,55,0.22)",
        background: "rgba(10,6,17,0.6)",
      }}
    >
      {sides.map(({ team, side, first }) => {
        const isPick = pickedId === team.id;
        const dim = pickedId !== null && !isPick;
        const share = pool > 0 ? Math.round((side / pool) * 100) : null;
        return (
          <button
            key={team.id}
            type="button"
            onClick={onPick ? () => onPick(team.id) : undefined}
            disabled={!onPick}
            className="relative flex flex-col items-center py-5 px-3 transition-all"
            style={{
              cursor: onPick ? "pointer" : "default",
              borderRight: first ? "1px solid rgba(212,175,55,0.18)" : "none",
              background: isPick
                ? "linear-gradient(165deg, rgba(124,58,237,0.32), rgba(124,58,237,0.08) 70%)"
                : "transparent",
              opacity: dim ? 0.4 : 1,
              boxShadow: isPick ? "inset 0 0 34px rgba(124,58,237,0.18)" : "none",
            }}
          >
            {isPick && (
              <span
                className="absolute top-0 left-1/2 text-[8px] font-bold uppercase rounded-b-md px-2.5 py-0.5"
                style={{
                  transform: "translateX(-50%)",
                  letterSpacing: "2px",
                  color: "#fff",
                  background: "linear-gradient(90deg, #7c3aed, #9d5cf0)",
                  boxShadow: "0 2px 10px rgba(124,58,237,0.5)",
                }}
              >
                Tu pick
              </span>
            )}
            <span
              className="font-cinzel font-semibold text-[16px] mt-2 max-w-full truncate"
              style={{ color: isPick ? "var(--vertigo-text)" : "var(--vertigo-muted)" }}
              title={team.name}
            >
              {team.name}
            </span>
            {team.seed != null && (
              <span className="text-[9px] uppercase mt-0.5" style={{ letterSpacing: "1.5px", color: "var(--vertigo-faint)" }}>
                Seed #{team.seed}
              </span>
            )}
            <span
              className="font-cinzel font-bold leading-none mt-2.5"
              style={{
                fontSize: 34,
                color: isPick ? "var(--vertigo-purple-pale)" : "var(--vertigo-muted)",
                textShadow: isPick ? "0 0 24px rgba(157,92,240,0.45)" : "none",
              }}
            >
              {cuota(pool, side)}
            </span>
            <span className="text-[10px] mt-1.5" style={{ color: "var(--vertigo-faint)" }}>
              {share != null
                ? `${share}% del pozo`
                : side > 0
                ? `${fmt(side)} pts apostados`
                : "sin apuestas aún"}
            </span>
          </button>
        );
      })}
      {/* VS solapado en la costura */}
      <span
        className="absolute left-1/2 top-1/2 z-10 flex items-center justify-center rounded-full font-cinzel font-bold"
        style={{
          width: 36,
          height: 36,
          transform: "translate(-50%, -50%)",
          fontSize: 10,
          letterSpacing: "1px",
          color: "var(--vertigo-faint)",
          background: "#0b0713",
          border: "1px solid rgba(212,175,55,0.3)",
          boxShadow: "0 0 0 5px rgba(10,6,17,0.95)",
        }}
      >
        VS
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// La boleta vacía: lado → monto → premio → confirmar
// ─────────────────────────────────────────────────────────────

function BetForm({
  context,
  matchId,
  teamA,
  teamB,
}: {
  context: SpectatorBetContext;
  matchId: string;
  teamA: TeamRef;
  teamB: TeamRef;
}) {
  const router = useRouter();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [stakeStr, setStakeStr] = useState("");
  const [loading, setLoading] = useState(false);

  const stake = Number.parseInt(stakeStr, 10);
  // Tope anti-ballena (espejo del server): 33% del pozo, piso 100.
  const maxStake = Math.max(100, Math.floor(context.pool * 0.33));
  const tope = Math.min(context.balance, maxStake);
  const validStake = Number.isFinite(stake) && stake >= 1 && stake <= tope;

  const pickedTeam = pickedId === teamA.id ? teamA : pickedId === teamB.id ? teamB : null;
  const pickedSide = pickedId === teamA.id ? context.stakeA : pickedId === teamB.id ? context.stakeB : 0;
  const proyectada = pickedId && validStake ? cuotaProyectada(context.pool, pickedSide, stake) : null;
  const payoutEstimado =
    proyectada !== null && validStake
      ? Math.min(Math.floor(stake * proyectada), stake * BET_MAX_PAYOUT_MULT)
      : null;

  const quicks = useMemo(() => {
    const b = Math.min(context.balance, maxStake);
    return [
      { label: "25%", value: Math.max(1, Math.floor(b * 0.25)) },
      { label: "50%", value: Math.max(1, Math.floor(b * 0.5)) },
      { label: "Todo", value: b },
    ];
  }, [context.balance, maxStake]);

  async function confirm() {
    if (!pickedId || !validStake || loading) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("match_id", matchId);
      fd.set("picked_team_id", pickedId);
      fd.set("stake", String(stake));
      const result = await placeBetAction(fd);
      if (!result.ok) {
        toast.error("No se pudo apostar", { description: result.error });
        return;
      }
      toast.success("¡Apuesta registrada!", {
        description: `Apostaste ${fmt(stake)} puntos. Suerte.`,
      });
      router.refresh();
    } catch (err) {
      toast.error("No se pudo apostar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setLoading(false);
    }
  }

  if (context.balance <= 0) {
    return (
      <div className="vertigo-empty" style={{ padding: "32px 24px" }}>
        <Coins style={{ width: 36, height: 36, color: "var(--vertigo-faint)", margin: "0 auto 12px" }} strokeWidth={1} />
        <div className="vertigo-empty-title">Sin saldo</div>
        <p className="vertigo-empty-desc">
          Ya apostaste todos tus puntos. Ganá apuestas para recuperar saldo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PoolBar
        pool={context.pool}
        stakeA={context.stakeA}
        stakeB={context.stakeB}
        teamA={teamA}
        teamB={teamB}
        bettors={context.bettors}
      />

      {/* LA BOLETA */}
      <div
        className="flex flex-col gap-4"
        style={{
          border: "1px solid rgba(212,175,55,0.22)",
          borderRadius: 16,
          background: "linear-gradient(180deg, rgba(17,11,28,0.65), rgba(10,6,17,0.5))",
          padding: "18px 18px 16px",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="font-cinzel font-bold text-[15px] truncate"
            style={{ color: "var(--vertigo-text)" }}
          >
            {pickedTeam ? (
              <>
                Tu boleta va con{" "}
                <span style={{ color: "var(--vertigo-purple-pale)" }}>{pickedTeam.name}</span>
              </>
            ) : (
              "¿Quién gana esta llave?"
            )}
          </span>
          <span
            className="text-[9px] uppercase font-bold flex-none"
            style={{ letterSpacing: "2.5px", color: "var(--vertigo-gold)" }}
          >
            Boleta
          </span>
        </div>

        <PickControl
          pool={context.pool}
          teamA={teamA}
          teamB={teamB}
          stakeA={context.stakeA}
          stakeB={context.stakeB}
          pickedId={pickedId}
          onPick={setPickedId}
        />

        {/* Monto: se enciende al elegir lado */}
        <div
          className="flex flex-col gap-3"
          style={{
            opacity: pickedTeam ? 1 : 0.35,
            transition: "opacity 200ms ease",
            pointerEvents: pickedTeam ? "auto" : "none",
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px]" style={{ color: "var(--vertigo-faint)" }}>
              Tenés{" "}
              <span className="font-bold text-[var(--vertigo-gold)]">{fmt(context.balance)} pts</span>{" "}
              disponibles
            </span>
            <div className="flex gap-1.5">
              {quicks.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setStakeStr(String(Math.min(q.value, tope, context.balance)))}
                  className="vertigo-btn vertigo-btn-ghost"
                  style={{ padding: "4px 10px", fontSize: "10px" }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-baseline justify-center gap-2">
            <input
              type="number"
              min={1}
              max={context.balance}
              step={1}
              value={stakeStr}
              onChange={(e) => setStakeStr(e.target.value)}
              placeholder="0"
              className="vertigo-input font-cinzel font-bold text-center"
              style={{ fontSize: 30, width: 200, padding: "8px 12px" }}
            />
            <span className="font-cinzel text-[14px]" style={{ color: "var(--vertigo-faint)" }}>
              pts
            </span>
          </div>
          <div className="text-center text-[10px] -mt-1" style={{ color: "var(--vertigo-faint)" }}>
            Tope de esta llave: <span className="font-bold text-[var(--vertigo-gold)]">{fmt(maxStake)} pts</span> (33% del pozo) · cancelar devuelve el 75%
          </div>
          {stakeStr !== "" && !validStake && (
            <div className="text-center text-[11px] text-[var(--vertigo-danger)]">
              {stake > tope
                ? `Superás el tope: máximo ${fmt(tope)} pts en esta llave.`
                : `Ingresá un entero entre 1 y ${fmt(tope)}.`}
            </div>
          )}
        </div>

        {/* Premio proyectado + confirmar */}
        {pickedTeam && validStake && proyectada !== null && payoutEstimado !== null ? (
          <>
            <div
              className="rounded-xl text-center"
              style={{
                padding: "14px 16px",
                border: "1px solid rgba(34,197,94,0.45)",
                background: "rgba(34,197,94,0.06)",
              }}
            >
              <div
                className="text-[9px] uppercase font-bold"
                style={{ letterSpacing: "2.5px", color: "var(--vertigo-faint)" }}
              >
                Si gana {pickedTeam.name}, cobrás
              </div>
              <div
                className="font-cinzel font-bold leading-none mt-1.5"
                style={{ fontSize: 38, color: "var(--vertigo-success)", textShadow: "0 0 26px rgba(34,197,94,0.35)" }}
              >
                +{fmt(payoutEstimado)} pts
              </div>
              <div className="text-[10px] mt-1.5" style={{ color: "var(--vertigo-faint)" }}>
                cuota ×{proyectada.toFixed(2)} · puede bajar si más gente apuesta a lo mismo
              </div>
            </div>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={loading}
              className={`inline-flex items-center justify-center gap-2 font-cinzel font-bold uppercase ${loading ? "" : "apu-cta"}`}
              style={{
                width: "100%",
                padding: "15px 20px",
                borderRadius: 12,
                fontSize: 13,
                letterSpacing: "1.5px",
                border: "none",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Ticket style={{ width: 15, height: 15 }} />
              {loading ? "Apostando…" : `Confirmar ${fmt(stake)} pts a ${pickedTeam.name}`}
            </button>
          </>
        ) : (
          <div className="text-center text-[11px]" style={{ color: "var(--vertigo-faint)" }}>
            {!pickedTeam
              ? "Tocá un lado para llenar tu boleta"
              : "Ahora definí cuánto querés jugar"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Boleta jugada (pendiente) y la llave sigue abierta
// ─────────────────────────────────────────────────────────────

function MyPendingBet({
  context,
  teamA,
  teamB,
}: {
  context: SpectatorBetContext;
  teamA: TeamRef;
  teamB: TeamRef;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const bet = context.myBet!;
  const picked = bet.pickedTeamId === teamA.id ? teamA : teamB;
  const sideStake = bet.pickedTeamId === teamA.id ? context.stakeA : context.stakeB;
  const cuotaActual = context.pool > 0 && sideStake > 0 ? context.pool / sideStake : null;
  const cobroSiGana =
    cuotaActual !== null
      ? Math.min(Math.floor(bet.stake * cuotaActual), bet.stake * BET_MAX_PAYOUT_MULT)
      : null;

  async function cancel() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await cancelBetAction(bet.id);
      if (!result.ok) {
        toast.error("No se pudo cancelar", { description: result.error });
        return;
      }
      toast.success("Apuesta cancelada", {
        description: `Te reintegramos ${fmt(Math.floor(bet.stake * 0.75))} puntos (penalidad del 25%).`,
      });
      router.refresh();
    } catch (err) {
      toast.error("No se pudo cancelar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PoolBar
        pool={context.pool}
        stakeA={context.stakeA}
        stakeB={context.stakeB}
        teamA={teamA}
        teamB={teamB}
        bettors={context.bettors}
      />

      {/* Boleta estampada */}
      <div
        className="flex flex-col gap-4"
        style={{
          border: "1px solid rgba(34,197,94,0.4)",
          borderRadius: 16,
          background: "linear-gradient(180deg, rgba(17,11,28,0.65), rgba(10,6,17,0.5))",
          padding: "18px 18px 16px",
          boxShadow: "0 0 30px rgba(34,197,94,0.06)",
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span
            className="flex items-center gap-2 text-[10px] uppercase font-bold"
            style={{ letterSpacing: "2.5px", color: "var(--vertigo-success)" }}
          >
            ✓ Boleta jugada
          </span>
          <span className="text-[11px]" style={{ color: "var(--vertigo-faint)" }}>
            Apostaste{" "}
            <span className="font-bold text-[var(--vertigo-gold)]">{fmt(bet.stake)} pts</span>
          </span>
        </div>

        <PickControl
          pool={context.pool}
          teamA={teamA}
          teamB={teamB}
          stakeA={context.stakeA}
          stakeB={context.stakeB}
          pickedId={bet.pickedTeamId}
        />

        {cobroSiGana !== null && cuotaActual !== null ? (
          <div
            className="rounded-xl text-center"
            style={{
              padding: "13px 16px",
              border: "1px solid rgba(34,197,94,0.35)",
              background: "rgba(34,197,94,0.05)",
            }}
          >
            <div
              className="text-[9px] uppercase font-bold"
              style={{ letterSpacing: "2.5px", color: "var(--vertigo-faint)" }}
            >
              Si gana {picked.name}, cobrás
            </div>
            <div
              className="font-cinzel font-bold leading-none mt-1.5"
              style={{ fontSize: 32, color: "var(--vertigo-success)", textShadow: "0 0 24px rgba(34,197,94,0.3)" }}
            >
              +{fmt(cobroSiGana)} pts
            </div>
            <div className="text-[10px] mt-1.5" style={{ color: "var(--vertigo-faint)" }}>
              a la cuota actual ×{cuotaActual.toFixed(2)} — se mueve con cada apuesta nueva
            </div>
          </div>
        ) : (
          <div className="text-center text-[11px]" style={{ color: "var(--vertigo-faint)" }}>
            Todavía no hay cuota fija: se define con el pozo cuando cierre la apuesta.
          </div>
        )}

        <button
          type="button"
          onClick={() => void cancel()}
          disabled={loading}
          className="vertigo-btn vertigo-btn-ghost"
          style={{
            width: "100%",
            padding: "11px",
            fontSize: "11px",
            color: "var(--vertigo-danger)",
            borderColor: "rgba(251,113,133,0.4)",
          }}
        >
          <Undo2 style={{ width: 12, height: 12 }} />
          {loading ? "Cancelando…" : "Cancelar boleta (devuelve el 75%)"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Llave cerrada (abierta, en juego o liquidada) → solo lectura
// ─────────────────────────────────────────────────────────────

function ClosedView({
  context,
  status,
  teamA,
  teamB,
}: {
  context: SpectatorBetContext;
  status: string;
  teamA: TeamRef | null;
  teamB: TeamRef | null;
}) {
  const bet = context.myBet;

  if (!bet) {
    return (
      <div className="vertigo-empty" style={{ padding: "32px 24px" }}>
        <Lock style={{ width: 36, height: 36, color: "var(--vertigo-faint)", margin: "0 auto 12px" }} strokeWidth={1} />
        <div className="vertigo-empty-title">Apuestas cerradas</div>
        <p className="vertigo-empty-desc">
          {status === "cancelled"
            ? "La llave fue cancelada."
            : "Las apuestas cerraron cuando la llave abrió. Apostá en la próxima llave."}
        </p>
      </div>
    );
  }

  const picked = teamA && bet.pickedTeamId === teamA.id ? teamA : teamB;

  if (bet.status === "won") {
    return (
      <ResultBox
        icon={<Trophy style={{ width: 18, height: 18 }} />}
        tone="success"
        title={`¡Ganaste ${fmt(bet.payout)} puntos!`}
        desc={`Acertaste: ${picked?.name ?? "tu pick"} ganó la llave.`}
      />
    );
  }
  if (bet.status === "lost") {
    return (
      <ResultBox
        icon={<XCircle style={{ width: 18, height: 18 }} />}
        tone="danger"
        title="No acertaste esta vez"
        desc={`Tu pick era ${picked?.name ?? "?"}. Los ${fmt(bet.stake)} puntos quedaron en el pozo.`}
      />
    );
  }
  if (bet.status === "voided") {
    return (
      <ResultBox
        icon={<AlertTriangle style={{ width: 18, height: 18 }} />}
        tone="warning"
        title={`Reintegro: +${fmt(bet.stake)} puntos`}
        desc="La llave fue cancelada y tu apuesta se devolvió."
      />
    );
  }

  // pending pero la llave ya abrió → en juego hasta que termine
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center justify-between gap-3 rounded-xl flex-wrap"
        style={{ padding: "14px 16px", border: "1px solid rgba(124,58,237,0.45)", background: "rgba(124,58,237,0.08)" }}
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--vertigo-purple-soft)] mb-1">
            Tu boleta está en juego
          </div>
          <div className="font-cinzel text-[15px] font-semibold text-[var(--vertigo-text)] truncate">
            {picked?.name ?? "Tu pick"} gana la llave
          </div>
          <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">
            Apostaste <span className="text-[var(--vertigo-purple-pale)] font-bold">{fmt(bet.stake)} pts</span>
          </div>
        </div>
        <span className="vertigo-badge vertigo-badge-purple flex-none">En juego</span>
      </div>
      <div className="text-[10px] text-[var(--vertigo-faint)]">
        La llave ya abrió: tu apuesta se liquida automáticamente cuando termine.
      </div>
    </div>
  );
}

const TONE_STYLES: Record<string, { border: string; bg: string; color: string }> = {
  success: { border: "rgba(34,197,94,0.5)", bg: "rgba(34,197,94,0.08)", color: "var(--vertigo-success)" },
  danger: { border: "rgba(251,113,133,0.5)", bg: "rgba(251,113,133,0.07)", color: "var(--vertigo-danger)" },
  warning: { border: "rgba(251,191,36,0.5)", bg: "rgba(251,191,36,0.07)", color: "var(--vertigo-warning)" },
};

function ResultBox({
  icon,
  tone,
  title,
  desc,
}: {
  icon: React.ReactNode;
  tone: "success" | "danger" | "warning";
  title: string;
  desc: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div
      className="flex items-start gap-3 rounded-xl"
      style={{ padding: "14px 16px", border: `1px solid ${t.border}`, background: t.bg }}
    >
      <span style={{ color: t.color, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div className="min-w-0">
        <div className="font-cinzel text-[14px] font-semibold" style={{ color: t.color }}>
          {title}
        </div>
        <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">{desc}</div>
      </div>
    </div>
  );
}
