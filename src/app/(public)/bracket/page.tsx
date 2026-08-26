import Link from "next/link";
import { Trophy, Brackets, Swords, Radio, ChevronRight } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateBracket } from "@/lib/bracket/engine";
import BracketTree, {
  type BracketMatchInfo,
} from "@/components/bracket/bracket-tree";
import VertigoFooter from "@/components/shared/vertigo-footer";

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
  championName: string | null;
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
    if (!bracket) return { matches: [], editionName: edition.name, championName: null };

    const { data: rounds } = (await supabase
      .from("round")
      .select("id, index, name, bracket_id")
      .eq("bracket_id", bracket.id)
      .order("index", { ascending: true })) as { data: any };

    if (!rounds || rounds.length === 0) return { matches: [], editionName: edition.name, championName: null };

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

    // Campeón: ganador de la final (ronda de mayor índice)
    let championName: string | null = null;
    const finalRound = rounds[rounds.length - 1];
    const finalMatch = matches.find(
      (m) => m.roundIndex === (finalRound?.index ?? 0) && m.winnerTeamId
    );
    if (finalMatch) {
      const champ = finalMatch.winnerTeamId === finalMatch.teamA?.id ? finalMatch.teamA : finalMatch.teamB;
      championName = champ?.name ?? null;
    }

    return { matches, editionName: edition.name, championName };
  } catch {
    return null;
  }
}

export default async function BracketPage() {
  const data = await loadBracketMatches();
  const bracketSize = 32;
  const structure = generateBracket(bracketSize);
  const matches = data?.matches ?? [];
  const editionName = data?.editionName ?? null;

  // Live: partidos en estado dinámico ahora mismo
  const liveNow = matches.filter((m) =>
    ["drawing", "lineup", "comodin_window", "in_progress", "open"].includes(m.status)
  );

  const treeMatches: BracketMatchInfo[] = matches.map((m) => ({
    id: m.id,
    roundIndex: m.roundIndex,
    slotIndex: m.slotIndex,
    seedA: m.teamA?.seed ?? null,
    seedB: m.teamB?.seed ?? null,
    status: m.status,
    scheduledAtStart: m.scheduledAtStart,
    teamA: m.teamA,
    teamB: m.teamB,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winnerTeamId: m.winnerTeamId,
  }));

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">BRACKET</span>
        </div>
        <div className="vertigo-header-right">
          <Link href="/apuestas" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Apuestas
          </Link>
          <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Resultados
          </Link>
        </div>
      </header>

      <main className="vertigo-content" style={{ maxWidth: "none", padding: "40px 32px" }}>
        {/* ═══ HERO ═══ */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 18,
            border: "1px solid var(--vertigo-line-soft)",
            marginBottom: 24,
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
              SINGLE ELIMINATION · 32 REINOS · 5 RONDAS
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

            {/* Stats rápidas */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              {editionName && (
                <span className="vertigo-badge vertigo-badge-purple" style={{ padding: "7px 14px", fontSize: 11 }}>
                  <Trophy style={{ width: 12, height: 12 }} />
                  {editionName}
                </span>
              )}
              <span className="vertigo-badge vertigo-badge-warning" style={{ padding: "7px 14px", fontSize: 11 }}>
                <Swords style={{ width: 12, height: 12 }} />
                {matches.length > 0 ? `${matches.length} llaves` : "32 llaves"}
              </span>
              {liveNow.length > 0 && (
                <span className="vertigo-badge vertigo-badge-success" style={{ padding: "7px 14px", fontSize: 11 }}>
                  <Radio style={{ width: 12, height: 12 }} />
                  {liveNow.length} en vivo
                </span>
              )}
              {data?.championName && (
                <span className="vertigo-badge vertigo-badge-success" style={{ padding: "7px 14px", fontSize: 11 }}>
                  <Trophy style={{ width: 12, height: 12 }} />
                  Campeón: {data.championName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Leyenda */}
        <div className="vertigo-action-bar" style={{ marginBottom: "22px" }}>
          <span className="vertigo-badge vertigo-badge-purple">Programado</span>
          <span className="vertigo-badge vertigo-badge-success">En juego / Abierto</span>
          <span className="vertigo-badge vertigo-badge-warning">Sorteo / Comodines</span>
          <span className="vertigo-badge vertigo-badge-danger">Disputa / W.O.</span>
          <Link href="/fixture" className="vertigo-btn vertigo-btn-ghost" style={{ marginLeft: "auto", padding: "6px 14px", fontSize: "11px" }}>
            Ver fixture
            <ChevronRight style={{ width: 12, height: 12 }} />
          </Link>
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
          <BracketTree
            rounds={structure.rounds}
            matches={treeMatches}
            hrefPrefix="/partido"
            championName={data.championName}
          />
        )}

        {/* ═══ FOOTER CINEMATOGRÁFICO ═══ */}
        <div style={{ marginTop: 28 }}>
          <VertigoFooter />
        </div>
      </main>
    </div>
  );
}
