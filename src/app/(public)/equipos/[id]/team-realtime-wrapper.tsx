"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Calendar, Swords, ArrowRight } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import LocalTime from "@/components/shared/local-time";

export interface NextMatchData {
  id: string;
  status: string;
  scheduledAtStart: string | null;
  scheduledAtEnd: string | null;
  jornadaLabel: string | null;
  format: string | null;
  opponentName: string | null;
  opponentSeed: number | null;
  roundName: string | null;
  drawResult: {
    gameMode?: string;
    antimetaMode?: string;
    playerMode?: string;
    map?: string;
    civsA?: string[];
    civsB?: string[];
  } | null;
}

interface Props {
  teamRegistrationId: string;
  initialNextMatch: NextMatchData | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Programado", cls: "vertigo-badge-purple" },
  open: { label: "Abierto", cls: "vertigo-badge-success" },
  drawing: { label: "Sorteando", cls: "vertigo-badge-warning" },
  lineup: { label: "Lineup", cls: "vertigo-badge-warning" },
  comodin_window: { label: "Comodines", cls: "vertigo-badge-warning" },
  in_progress: { label: "En juego", cls: "vertigo-badge-success" },
  finished: { label: "Finalizado", cls: "vertigo-badge-purple" },
  disputed: { label: "Disputa", cls: "vertigo-badge-danger" },
  forfeit: { label: "W.O.", cls: "vertigo-badge-danger" },
  cancelled: { label: "Cancelado", cls: "vertigo-badge-danger" },
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function TeamRealtimeWrapper({ teamRegistrationId, initialNextMatch }: Props) {
  const [nextMatch, setNextMatch] = useState<NextMatchData | null>(initialNextMatch);
  const now = useNow(1000);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`team-${teamRegistrationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match",
          filter: `team_a_id=eq.${teamRegistrationId}`,
        },
        () => {
          void refreshMatch();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match",
          filter: `team_b_id=eq.${teamRegistrationId}`,
        },
        () => {
          void refreshMatch();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "roulette_draw",
        },
        () => {
          void refreshMatch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamRegistrationId]);

  async function refreshMatch() {
    try {
      const supabase = getSupabaseBrowser();
      // Buscamos los matches donde este team es A o B y no esté cancelado
      const { data: matchesA } = await supabase
        .from("match")
        .select(
          "id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, team_b_id, team_a_id, round_id"
        )
        .eq("team_a_id", teamRegistrationId)
        .neq("status", "cancelled")
        .neq("status", "finished")
        .order("scheduled_at_start", { ascending: true, nullsFirst: false })
        .limit(1);

      const { data: matchesB } = await supabase
        .from("match")
        .select(
          "id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, team_a_id, team_b_id, round_id"
        )
        .eq("team_b_id", teamRegistrationId)
        .neq("status", "cancelled")
        .neq("status", "finished")
        .order("scheduled_at_start", { ascending: true, nullsFirst: false })
        .limit(1);

      const candidates: any[] = [];
      if (matchesA && matchesA.length > 0) candidates.push(matchesA[0]);
      if (matchesB && matchesB.length > 0) candidates.push(matchesB[0]);

      if (candidates.length === 0) {
        setNextMatch(null);
        return;
      }

      // Tomar el más cercano en el tiempo
      const match = candidates.sort((a, b) => {
        const ta = a.scheduled_at_start ? new Date(a.scheduled_at_start).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.scheduled_at_start ? new Date(b.scheduled_at_start).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      })[0];

      const isTeamA = match.team_a_id === teamRegistrationId;
      const opponentId = isTeamA ? match.team_b_id : match.team_a_id;

      let opponentName: string | null = null;
      let opponentSeed: number | null = null;
      if (opponentId) {
        const { data: opp } = (await supabase
          .from("team_registration")
          .select("seed, team_account:team_account_id ( name )")
          .eq("id", opponentId)
          .maybeSingle()) as { data: any };
        if (opp) {
          opponentName = opp.team_account?.name ?? null;
          opponentSeed = opp.seed ?? null;
        }
      }

      let roundName: string | null = null;
      if (match.round_id) {
        const { data: round } = (await supabase
          .from("round")
          .select("name")
          .eq("id", match.round_id)
          .maybeSingle()) as { data: any };
        if (round) roundName = round.name;
      }

      // Draw result (latest draw for first game of this match)
      let drawResult: NextMatchData["drawResult"] = null;
      const { data: games } = (await supabase
        .from("match_game")
        .select("id, game_number, draw_id, game_mode, antimeta_mode, player_mode, map, civs_a, civs_b")
        .eq("match_id", match.id)
        .order("game_number", { ascending: false })
        .limit(3)) as { data: any };

      if (games && games.length > 0) {
        // Preferir la partida más reciente con sorteo (en BO3 1-1, la decisiva).
        const g = games.find((x: any) => x.draw_id || x.map) ?? games[0];
        if (g.draw_id) {
          const { data: draw } = (await supabase
            .from("roulette_draw")
            .select("result, status")
            .eq("id", g.draw_id)
            .maybeSingle()) as { data: any };
          if (draw && draw.result) {
            const r = draw.result as any;
            drawResult = {
              gameMode: r.gameMode ?? g.game_mode ?? undefined,
              antimetaMode: r.antimetaMode ?? g.antimeta_mode ?? undefined,
              playerMode: r.playerMode ?? g.player_mode ?? undefined,
              map: r.map ?? g.map ?? undefined,
              civsA: r.civsA ?? g.civs_a ?? undefined,
              civsB: r.civsB ?? g.civs_b ?? undefined,
            };
          }
        }
      }

      setNextMatch({
        id: match.id,
        status: match.status,
        scheduledAtStart: match.scheduled_at_start ?? null,
        scheduledAtEnd: match.scheduled_at_end ?? null,
        jornadaLabel: match.jornada_label ?? null,
        format: match.format ?? null,
        opponentName,
        opponentSeed,
        roundName,
        drawResult,
      });
    } catch {
      // ignore
    }
  }

  if (!nextMatch) {
    return (
      <div className="vertigo-card">
        <div className="vertigo-empty">
          <Calendar
            style={{ width: 40, height: 40, color: "var(--vertigo-faint)", margin: "0 auto 12px" }}
            strokeWidth={1}
          />
          <div className="vertigo-empty-title">Sin partidos programados</div>
          <p className="vertigo-empty-desc">
            Cuando el bracket se genere y se asigne el próximo partido, vas a verlo acá con
            countdown en vivo y resultado del sorteo.
          </p>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[nextMatch.status] ?? STATUS_META.scheduled;
  const start = nextMatch.scheduledAtStart ? new Date(nextMatch.scheduledAtStart).getTime() : null;
  const countdown = start ? start - now : null;

  const draw = nextMatch.drawResult;

  return (
    <div className="vertigo-card">
      {/* Fondo animado de la próxima partida */}
      <video
        autoPlay
        muted
        loop
        playsInline
        src="/landing/proxima-partida-bg.mp4"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          pointerEvents: "none",
        }}
      />
      {/* Velo oscuro para mantener la legibilidad del contenido */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(7,3,16,0.70) 0%, rgba(7,3,16,0.78) 55%, rgba(7,3,16,0.88) 100%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
      <div className="vertigo-card-header">
        <div className="vertigo-card-title">
          <Calendar
            style={{ width: 16, height: 16, display: "inline", marginRight: 8, color: "var(--vertigo-purple-soft)" }}
          />
          Próxima partida
        </div>
        <span className={`vertigo-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
      </div>

      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
      >
        <div className="vertigo-info-card">
          <div className="vertigo-info-card-label">Rival</div>
          <div className="vertigo-info-card-value truncate">
            {nextMatch.opponentName ?? "Por definir"}
          </div>
          {nextMatch.opponentSeed != null && (
            <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">
              Seed #{nextMatch.opponentSeed}
            </div>
          )}
        </div>
        <div className="vertigo-info-card">
          <div className="vertigo-info-card-label">Ronda</div>
          <div className="vertigo-info-card-value">{nextMatch.roundName ?? "—"}</div>
          {nextMatch.jornadaLabel && (
            <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">
              {nextMatch.jornadaLabel}
            </div>
          )}
        </div>
        <div className="vertigo-info-card">
          <div className="vertigo-info-card-label">Formato</div>
          <div className="vertigo-info-card-value">{nextMatch.format ?? "—"}</div>
        </div>
        {nextMatch.scheduledAtStart && (
          <div className="vertigo-info-card">
            <div className="vertigo-info-card-label">Inicio</div>
            <div className="vertigo-info-card-value" style={{ fontSize: 13 }}>
              <LocalTime value={nextMatch.scheduledAtStart} variant="dayMonTime" />
            </div>
          </div>
        )}
      </div>

      {/* Countdown */}
      {countdown !== null && countdown > 0 && nextMatch.status === "scheduled" && (
        <div className="vertigo-stat" style={{ textAlign: "center", marginBottom: 16 }}>
          <div className="vertigo-stat-label">Comienza en</div>
          <div className="vertigo-stat-value">
            <Clock
              style={{ width: 22, height: 22, display: "inline", marginRight: 10, verticalAlign: "middle" }}
              strokeWidth={1.25}
            />
            {formatCountdown(countdown)}
          </div>
        </div>
      )}

      {/* Resultado del sorteo */}
      {draw && (
        <div>
          <div className="vertigo-subtitle">
            <Swords style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
            Sorteo publicado
          </div>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
          >
            {draw.gameMode && (
              <div className="vertigo-info-card">
                <div className="vertigo-info-card-label">Modo</div>
                <div className="vertigo-info-card-value">{draw.gameMode}</div>
              </div>
            )}
            {draw.antimetaMode && (
              <div className="vertigo-info-card">
                <div className="vertigo-info-card-label">Antimeta</div>
                <div className="vertigo-info-card-value">{draw.antimetaMode}</div>
              </div>
            )}
            {draw.playerMode && (
              <div className="vertigo-info-card">
                <div className="vertigo-info-card-label">Jugadores</div>
                <div className="vertigo-info-card-value">{draw.playerMode}</div>
              </div>
            )}
            {draw.map && (
              <div className="vertigo-info-card">
                <div className="vertigo-info-card-label">Mapa</div>
                <div className="vertigo-info-card-value">{draw.map}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="vertigo-action-bar mt-5 pt-4 border-t border-[var(--vertigo-line-soft)]">
        <Link href={`/partido/${nextMatch.id}`} className="vertigo-btn vertigo-btn-primary">
          Ver partido
          <ArrowRight style={{ width: 14, height: 14 }} />
        </Link>
      </div>
      </div>
    </div>
  );
}
