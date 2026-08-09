"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { civName } from "@/lib/constants/civs";
import { Clock, Trophy, Eye, Sparkles } from "lucide-react";

interface TeamRealtimeWrapperProps {
  teamId: string;
  matchId: string;
  initialMatch: any;
  initialRival: any;
  initialGame: any;
  initialDraw: any;
  formatLabel?: string;
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

export default function TeamRealtimeWrapper({
  teamId,
  matchId,
  initialMatch,
  initialRival,
  initialGame,
  initialDraw,
  formatLabel,
}: TeamRealtimeWrapperProps) {
  const [match, setMatch] = useState(initialMatch);
  const [game, setGame] = useState(initialGame);
  const [draw, setDraw] = useState(initialDraw);
  const [now, setNow] = useState(Date.now());

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Realtime subscription al match
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
          .channel(`team-${teamId}-match-${matchId}`)
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
              if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
                setGame(payload.new);
                // Si el game tiene draw_id, fetchear el draw
                if (payload.new.draw_id && payload.new.draw_id !== draw?.id) {
                  fetchDraw(payload.new.draw_id);
                }
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("[TeamRealtime] error:", e);
      }
    }

    setupRealtime();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, teamId]);

  async function fetchDraw(drawId: string) {
    try {
      const res = await fetch(`/api/draw/info?id=${drawId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setDraw(data.draw);
      }
    } catch (e) {
      // Silently ignore
    }
  }

  // Calcular countdown
  const statusInfo = STATUS_INFO[match.status] ?? { label: match.status, color: "#6b7280" };
  const scheduledTime = match.scheduled_at_start ? new Date(match.scheduled_at_start).getTime() : null;
  const diffMs = scheduledTime ? scheduledTime - now : null;
  const isCountingDown = diffMs !== null && diffMs > 0 && match.status === "scheduled";

  // Formatear countdown
  let countdownStr = "";
  if (isCountingDown && diffMs !== null) {
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) {
      countdownStr = `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      countdownStr = `${hours}h ${minutes}m ${seconds}s`;
    } else {
      countdownStr = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    }
  }

  // Detectar si el sorteo está publicado (mostrar resultados)
  const drawPublished = draw?.status === "published" || draw?.status === "revealed";
  const drawSpinning = draw?.status === "spinning" || match.status === "drawing";

  return (
    <section style={{
      padding: "24px",
      background: "var(--vertigo-panel)",
      borderRadius: "16px",
      border: `1px solid ${statusInfo.color}55`,
      marginBottom: "32px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
      }}>
        <h2 style={{
          fontSize: "14px",
          color: "var(--vertigo-purple-soft)",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
        }}>
          Próxima partida
        </h2>
        <span style={{
          padding: "4px 12px",
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

      {/* Countdown o estado */}
      {isCountingDown && (
        <div style={{
          textAlign: "center",
          padding: "20px",
          background: "rgba(124,58,237,0.05)",
          borderRadius: "10px",
          marginBottom: "20px",
        }}>
          <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", letterSpacing: "2px", textTransform: "uppercase" }}>
            Comienza en
          </div>
          <div style={{
            fontSize: "32px",
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            color: "var(--vertigo-purple-soft)",
            marginTop: "4px",
            fontVariantNumeric: "tabular-nums",
          }}>
            {countdownStr}
          </div>
        </div>
      )}

      {/* Teams */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: "16px",
        alignItems: "center",
        marginBottom: "20px",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>TU EQUIPO</div>
          <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
            {match.team_a_id === teamId ? "Equipo A" : "Equipo B"}
          </div>
        </div>
        <div style={{ color: "var(--vertigo-muted)", fontSize: "12px" }}>VS</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>RIVAL</div>
          <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
            {initialRival?.team_account?.name ?? "Por definir"}
          </div>
        </div>
      </div>

      {/* Info del match */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "8px",
        fontSize: "12px",
      }}>
        <InfoItem
          icon={<Clock size={12} />}
          label="Horario"
          value={match.scheduled_at_start
            ? new Date(match.scheduled_at_start).toLocaleString("es-AR", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Por definir"}
        />
        <InfoItem
          icon={<Trophy size={12} />}
          label="Ronda"
          value={match.round?.name ?? "—"}
        />
        <InfoItem
          icon={<Sparkles size={12} />}
          label="Formato"
          value={formatLabel ?? match.format ?? "Por sortear"}
        />
        {match.jornada_label && (
          <InfoItem
            icon={<Clock size={12} />}
            label="Jornada"
            value={match.jornada_label}
          />
        )}
      </div>

      {/* Resultado del sorteo (si publicado) */}
      {drawPublished && game && (
        <div style={{
          marginTop: "20px",
          padding: "16px",
          background: "rgba(124,58,237,0.08)",
          borderRadius: "10px",
          border: "1px solid var(--vertigo-purple)",
        }}>
          <div style={{
            fontSize: "11px",
            color: "var(--vertigo-purple-soft)",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <Sparkles size={12} />
            Resultado del sorteo
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "8px",
            fontSize: "12px",
          }}>
            <DrawResult label="Modo" value={game.game_mode} />
            <DrawResult label="Antimeta" value={game.antimeta_mode} />
            <DrawResult label="Formato" value={game.player_mode} />
            <DrawResult label="Mapa" value={game.map} />
            {Array.isArray(game.civs_a) && game.civs_a.length > 0 && (
              <DrawResult
                label="Tus civs"
                value={game.civs_a.map((c: string) => civName(c)).join(", ")}
              />
            )}
            {Array.isArray(game.civs_b) && game.civs_b.length > 0 && (
              <DrawResult
                label="Civs rival"
                value={game.civs_b.map((c: string) => civName(c)).join(", ")}
              />
            )}
          </div>
          {draw && (
            <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--vertigo-muted)" }}>
              Sorteo: <code>{draw.id?.slice(0, 8)}</code>
              {" · "}
              <Link
                href={`/sorteos/${draw.id}/verificar`}
                style={{ color: "var(--vertigo-purple-soft)" }}
              >
                <Eye size={10} style={{ display: "inline", marginRight: "2px" }} />
                Verificar
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Spinner de sorteo en curso */}
      {drawSpinning && (
        <div style={{
          marginTop: "20px",
          padding: "20px",
          background: "rgba(251,191,36,0.08)",
          borderRadius: "10px",
          border: "1px solid var(--vertigo-warning)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "14px",
            color: "var(--vertigo-warning)",
            fontWeight: 700,
            animation: "pulse 1.5s ease-in-out infinite",
          }}>
            🎰 Sorteo en curso...
          </div>
          <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", marginTop: "4px" }}>
            La ruleta está girando. Los resultados aparecerán acá automáticamente.
          </div>
        </div>
      )}

      {/* Link al partido */}
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <Link
          href={`/partido/${matchId}`}
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "var(--vertigo-purple)",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          Ver partido →
        </Link>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </section>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      padding: "8px 12px",
      background: "var(--vertigo-bg)",
      borderRadius: "6px",
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
        marginTop: "2px",
        fontFamily: "Inter, sans-serif",
      }}>
        {value}
      </div>
    </div>
  );
}

function DrawResult({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: "10px", color: "var(--vertigo-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
        {label}
      </div>
      <div style={{ fontSize: "14px", color: "var(--vertigo-text)", fontWeight: 600, marginTop: "2px" }}>
        {value || "—"}
      </div>
    </div>
  );
}
