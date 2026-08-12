import Link from "next/link";
import { Trophy, Brackets } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateBracket } from "@/lib/bracket/engine";

export const dynamic = "force-dynamic";

interface BracketMatchData {
  id: string;
  roundIndex: number;
  roundName: string;
  slotIndex: number;
  status: string;
  scheduledAtStart: string | null;
  teamA: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  teamB: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
}

async function loadBracketMatches(): Promise<{
  matches: BracketMatchData[];
  editionName: string | null;
} | null> {
  try {
    const supabase = await getSupabaseServer();

    // Bracket principal (winner) de la edición activa
    const { data: editions } = (await supabase
      .from("tournament_edition")
      .select("id, name, status")
      .in("status", ["active", "registration", "finished"])
      .order("created_at", { ascending: false })
      .limit(1)) as { data: any };

    const edition = editions?.[0];
    if (!edition) return null;

    const { data: brackets } = (await supabase
      .from("bracket")
      .select("id, type, rounds_count")
      .eq("tournament_edition_id", edition.id)
      .eq("type", "winner")
      .limit(1)) as { data: any };

    const bracket = brackets?.[0];
    if (!bracket) return { matches: [], editionName: edition.name };

    const { data: rounds } = (await supabase
      .from("round")
      .select("id, index, name, bracket_id")
      .eq("bracket_id", bracket.id)
      .order("index", { ascending: true })) as { data: any };

    if (!rounds || rounds.length === 0) return { matches: [], editionName: edition.name };

    const roundIds = rounds.map((r: any) => r.id);

    const { data: matchesRaw } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, score_a, score_b, winner_team_id, team_a_id, team_b_id, slot_index, round_id")
      .in("round_id", roundIds)
      .order("slot_index", { ascending: true })) as { data: any };

    // Mapeo round_id → {index, name}
    const roundMap: Record<string, { index: number; name: string }> = {};
    for (const r of rounds) {
      roundMap[r.id] = { index: r.index, name: r.name };
    }

    // Datos de teams con emblema real
    const teamIds: string[] = [];
    for (const m of matchesRaw ?? []) {
      if (m.team_a_id) teamIds.push(m.team_a_id);
      if (m.team_b_id) teamIds.push(m.team_b_id);
    }
    let teamMap: Record<string, { name: string; seed: number | null; emblemUrl: string | null }> = {};
    if (teamIds.length > 0) {
      const { data: teams } = (await supabase
        .from("team_registration")
        .select("id, seed, team_account:team_account_id ( name, emblem:emblem_id ( image_url ) )")
        .in("id", teamIds)) as { data: any };
      for (const t of teams ?? []) {
        teamMap[t.id] = {
          name: t.team_account?.name ?? "—",
          seed: t.seed ?? null,
          emblemUrl: t.team_account?.emblem?.image_url ?? null,
        };
      }
    }

    const matches: BracketMatchData[] = (matchesRaw ?? []).map((m: any) => {
      const r = roundMap[m.round_id];
      return {
        id: m.id,
        roundIndex: r?.index ?? 0,
        roundName: r?.name ?? "Ronda",
        slotIndex: m.slot_index,
        status: m.status,
        scheduledAtStart: m.scheduled_at_start ?? null,
        teamA: m.team_a_id ? { id: m.team_a_id, ...teamMap[m.team_a_id] } : null,
        teamB: m.team_b_id ? { id: m.team_b_id, ...teamMap[m.team_b_id] } : null,
        scoreA: m.score_a ?? 0,
        scoreB: m.score_b ?? 0,
        winnerTeamId: m.winner_team_id ?? null,
      };
    });

    return { matches, editionName: edition.name };
  } catch {
    return null;
  }
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
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

export default async function BracketPage() {
  const data = await loadBracketMatches();
  const bracketSize = 32;
  const structure = generateBracket(bracketSize);
  const matches = data?.matches ?? [];
  const editionName = data?.editionName ?? null;

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">BRACKET</span>
        </div>
        <div className="vertigo-header-right">
          {editionName && <span className="vertigo-badge vertigo-badge-purple">{editionName}</span>}
          <span className="vertigo-badge vertigo-badge-warning">SE · 32 equipos</span>
        </div>
      </header>

      <main className="vertigo-content" style={{ maxWidth: "none", padding: "40px 32px" }}>
        {/* ═══ HERO CINEMATOGRÁFICO ═══ */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 18,
            border: "1px solid var(--vertigo-line-soft)",
            marginBottom: 28,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Fondo: castillo + overlay violeta */}
          <div
            style={{
              position: "absolute", inset: 0,
              backgroundImage: "url('/landing/fondo-castillo.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
              opacity: 0.32,
              transform: "scale(1.04)",
            }}
          />
          <div
            style={{
              position: "absolute", inset: 0,
              background:
                "linear-gradient(180deg, rgba(7,3,16,0.35) 0%, rgba(7,3,16,0.78) 70%, rgba(7,3,16,0.94) 100%)",
            }}
          />
          {/* Línea dorada superior */}
          <div
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)",
            }}
          />
          <div style={{ position: "relative", zIndex: 2, padding: "44px 40px 36px" }}>
            <span className="vertigo-kicker">
              SINGLE ELIMINATION · 5 RONDAS
            </span>
            <h1
              className="vertigo-title"
              style={{
                fontSize: "clamp(30px, 4.6vw, 54px)",
                lineHeight: 0.95,
                margin: "6px 0 12px",
                textShadow: "0 4px 32px rgba(0,0,0,0.6)",
              }}
            >
              Llaves del torneo
            </h1>
            <p className="vertigo-desc" style={{ maxWidth: 640, margin: 0, fontSize: 15 }}>
              32 reinos entran. Uno queda en pie. Cada llave se sortea con la ruleta 15 minutos antes —
              nadie sabe qué va a pasar hasta que se juega. Tocá una llave para ver el partido con su sorteo en vivo.
            </p>
          </div>
        </div>

        {/* Leyenda */}
        <div className="vertigo-action-bar" style={{ marginBottom: "28px" }}>
          <span className="vertigo-badge vertigo-badge-purple">Programado</span>
          <span className="vertigo-badge vertigo-badge-success">En juego / Abierto</span>
          <span className="vertigo-badge vertigo-badge-warning">Sorteo / Comodines</span>
          <span className="vertigo-badge vertigo-badge-danger">Disputa / W.O.</span>
        </div>

        {!data || matches.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Brackets
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Bracket no generado</div>
              <p className="vertigo-empty-desc">
                Las llaves se publican acá apenas el staff confirma las 32 inscripciones y
                genera el bracket inicial.
              </p>
            </div>
          </div>
        ) : (
          <div className="vertigo-card" style={{ padding: 16 }}>
            <div className="vertigo-scroll" style={{ overflowX: "auto" }}>
              <div className="flex gap-4 min-w-max p-2">
                {structure.rounds.map((round) => {
                  const roundMatches = matches.filter((m) => m.roundIndex === round.index);
                  return (
                    <div key={round.index} style={{ width: 240, flex: "none" }}>
                      <div className="vertigo-subtitle" style={{ marginBottom: 14 }}>
                        {round.name}
                      </div>
                      <div className="flex flex-col gap-3">
                        {round.matches.map((slot) => {
                          const matchData = roundMatches.find((m) => m.slotIndex === slot.slotIndex);
                          return (
                            <BracketMatchCard
                              key={slot.tempId}
                              seedA={slot.seedA}
                              seedB={slot.seedB}
                              match={matchData ?? null}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BracketMatchCard({
  seedA,
  seedB,
  match,
}: {
  seedA: number | null;
  seedB: number | null;
  match: BracketMatchData | null;
}) {
  if (!match) {
    return (
      <div className="vertigo-link-card" style={{ cursor: "default", opacity: 0.5 }}>
        <div className="flex items-center justify-between text-[11px] text-[var(--vertigo-faint)] mb-2">
          <span>#{seedA ?? "?"} vs #{seedB ?? "?"}</span>
        </div>
        <div className="text-[13px] text-[var(--vertigo-faint)] italic">Por definir</div>
      </div>
    );
  }

  const statusMeta = STATUS_BADGE[match.status] ?? STATUS_BADGE.scheduled;
  const isAWinner = match.winnerTeamId && match.teamA && match.winnerTeamId === match.teamA.id;
  const isBWinner = match.winnerTeamId && match.teamB && match.winnerTeamId === match.teamB.id;

  return (
    <Link href={`/partido/${match.id}`} className="vertigo-link-card" style={{ padding: 14 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-[1.5px] uppercase text-[var(--vertigo-faint)]">
          #{match.teamA?.seed ?? seedA ?? "?"} vs #{match.teamB?.seed ?? seedB ?? "?"}
        </span>
        <span className={`vertigo-badge ${statusMeta.cls}`} style={{ padding: "2px 8px", fontSize: 9 }}>
          {statusMeta.label}
        </span>
      </div>
      <BracketTeamRow name={match.teamA?.name ?? "Por definir"} seed={match.teamA?.seed ?? seedA} score={match.scoreA} isWinner={!!isAWinner} emblemUrl={match.teamA?.emblemUrl} />
      <BracketTeamRow name={match.teamB?.name ?? "Por definir"} seed={match.teamB?.seed ?? seedB} score={match.scoreB} isWinner={!!isBWinner} emblemUrl={match.teamB?.emblemUrl} />
      {match.scheduledAtStart && match.status === "scheduled" && (
        <div className="text-[10px] text-[var(--vertigo-faint)] mt-2 pt-2 border-t border-[var(--vertigo-line-soft)]">
          {new Date(match.scheduledAtStart).toLocaleString("es-AR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </Link>
  );
}

function BracketTeamRow({
  name,
  seed,
  score,
  isWinner,
  emblemUrl,
}: {
  name: string;
  seed: number | null;
  score: number;
  isWinner: boolean;
  emblemUrl?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        {emblemUrl ? (
          <span
            className="flex-none rounded-full overflow-hidden border"
            style={{
              width: 22, height: 22,
              borderColor: isWinner ? "var(--vertigo-purple-soft)" : "var(--vertigo-line)",
              boxShadow: isWinner ? "0 0 10px rgba(124,58,237,0.35)" : "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emblemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </span>
        ) : (
          <Trophy
            style={{
              width: 12,
              height: 12,
              color: isWinner ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
            }}
            strokeWidth={1.25}
          />
        )}
        <span
          className={`text-[13px] truncate ${isWinner ? "text-[var(--vertigo-text)] font-medium" : "text-[var(--vertigo-muted)]"}`}
        >
          {name}
        </span>
        {seed != null && (
          <span className="text-[10px] text-[var(--vertigo-faint)] flex-none">#{seed}</span>
        )}
      </div>
      <span
        className={`font-cinzel text-[14px] font-bold tabular-nums flex-none ${isWinner ? "text-[var(--vertigo-purple-pale)]" : "text-[var(--vertigo-faint)]"}`}
      >
        {score}
      </span>
    </div>
  );
}
