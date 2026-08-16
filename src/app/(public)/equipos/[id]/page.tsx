import Link from "next/link";
import { notFound } from "next/navigation";
import { Shield, Users, Swords, History, Sparkles, Crown, Star, Trophy } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { civName } from "@/lib/constants/civs";
import TeamRealtimeWrapper, {
  type NextMatchData,
} from "./team-realtime-wrapper";

export const dynamic = "force-dynamic";

interface PlayerRow {
  id: string;
  displayName: string;
  country: string | null;
  clan: string | null;
  isCaptain: boolean;
  isVerified: boolean;
  aoe2ProfileId: number;
  maxRatingRm1v1: number | null;
  ratingRm1v1Current: number | null;
}

interface ComodinRow {
  rerollAvailable: number;
  anularAvailable: number;
  elegirRivalAvailable: number;
  invocarProAvailable: number;
}

interface HistoryMatchRow {
  id: string;
  status: string;
  format: string | null;
  scheduledAtStart: string | null;
  roundName: string | null;
  opponentName: string | null;
  scoreA: number;
  scoreB: number;
  isTeamA: boolean;
  winnerTeamId: string | null;
}

interface PageData {
  teamAccount: {
    id: string;
    name: string;
    tagline: string | null;
    emblemId: string | null;
    emblemUrl: string | null;
  };
  edition: {
    name: string;
    eloCap: number;
    eloTolerance: number;
  } | null;
  registration: {
    id: string;
    seed: number | null;
    eloFreezeSnapshot: number | null;
    baseCivIds: string[];
    extraCivIds: string[];
    status: string;
  };
  players: PlayerRow[];
  comodin: ComodinRow | null;
  history: HistoryMatchRow[];
  wins: number;
  losses: number;
  nextMatch: NextMatchData | null;
}

async function loadTeam(id: string): Promise<PageData | null> {
  try {
    const supabase = await getSupabaseServer();

    const { data: reg } = (await supabase
      .from("team_registration")
      .select(
        "id, seed, elo_freeze_snapshot, base_civ_ids, extra_civ_ids, status, team_account:team_account_id ( id, name, tagline, emblem_id, emblem:emblem_id ( image_url ) ), tournament_edition:tournament_edition_id ( name, elo_cap, elo_tolerance )"
      )
      .eq("id", id)
      .maybeSingle()) as { data: any };

    if (!reg) return null;

    const teamAccount = reg.team_account;
    const edition = reg.tournament_edition;

    // Players
    const { data: playersRaw } = (await supabase
      .from("player_registration")
      .select("id, display_name, country, clan, is_captain, is_verified, aoe2_profile_id, max_rating_rm_1v1, rating_rm_1v1_current")
      .eq("team_registration_id", reg.id)
      .order("is_captain", { ascending: false })) as { data: any };

    const players: PlayerRow[] = (playersRaw ?? []).map((p: any) => ({
      id: p.id,
      displayName: p.display_name,
      country: p.country ?? null,
      clan: p.clan ?? null,
      isCaptain: !!p.is_captain,
      isVerified: !!p.is_verified,
      aoe2ProfileId: p.aoe2_profile_id,
      maxRatingRm1v1: p.max_rating_rm_1v1 ?? null,
      ratingRm1v1Current: p.rating_rm_1v1_current ?? null,
    }));

    // Comodín inventory
    const { data: comodinRaw } = (await supabase
      .from("comodin_inventory")
      .select("reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
      .eq("team_registration_id", reg.id)
      .maybeSingle()) as { data: any };

    const comodin: ComodinRow | null = comodinRaw
      ? {
          rerollAvailable: comodinRaw.reroll_available ?? 0,
          anularAvailable: comodinRaw.anular_available ?? 0,
          elegirRivalAvailable: comodinRaw.elegir_rival_available ?? 0,
          invocarProAvailable: comodinRaw.invocar_pro_available ?? 0,
        }
      : null;

    // Historial: matches ya finalizados donde este team es A o B
    const { data: matchesA } = (await supabase
      .from("match")
      .select("id, status, format, scheduled_at_start, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id")
      .eq("team_a_id", reg.id)
      .in("status", ["finished", "forfeit", "disputed"])
      .order("scheduled_at_start", { ascending: false, nullsFirst: false })
      .limit(20)) as { data: any };

    const { data: matchesB } = (await supabase
      .from("match")
      .select("id, status, format, scheduled_at_start, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id")
      .eq("team_b_id", reg.id)
      .in("status", ["finished", "forfeit", "disputed"])
      .order("scheduled_at_start", { ascending: false, nullsFirst: false })
      .limit(20)) as { data: any };

    const allMatches: any[] = [...(matchesA ?? []), ...(matchesB ?? [])];

    // Traer nombres de rivales y rounds
    const opponentIds: string[] = [];
    const roundIds: string[] = [];
    for (const m of allMatches) {
      const oppId = m.team_a_id === reg.id ? m.team_b_id : m.team_a_id;
      if (oppId) opponentIds.push(oppId);
      if (m.round_id) roundIds.push(m.round_id);
    }

    let opponentNameMap: Record<string, string> = {};
    if (opponentIds.length > 0) {
      const { data: opps } = (await supabase
        .from("team_registration")
        .select("id, team_account:team_account_id ( name )")
        .in("id", opponentIds)) as { data: any };
      for (const o of opps ?? []) {
        opponentNameMap[o.id] = o.team_account?.name ?? "—";
      }
    }

    let roundNameMap: Record<string, string> = {};
    if (roundIds.length > 0) {
      const { data: rounds } = (await supabase
        .from("round")
        .select("id, name")
        .in("id", roundIds)) as { data: any };
      for (const r of rounds ?? []) {
        roundNameMap[r.id] = r.name;
      }
    }

    const history: HistoryMatchRow[] = allMatches
      .map((m) => {
        const isTeamA = m.team_a_id === reg.id;
        const opponentId = isTeamA ? m.team_b_id : m.team_a_id;
        return {
          id: m.id,
          status: m.status,
          format: m.format ?? null,
          scheduledAtStart: m.scheduled_at_start ?? null,
          roundName: m.round_id ? roundNameMap[m.round_id] ?? null : null,
          opponentName: opponentId ? opponentNameMap[opponentId] ?? null : null,
          scoreA: m.score_a ?? 0,
          scoreB: m.score_b ?? 0,
          isTeamA,
          winnerTeamId: m.winner_team_id ?? null,
        };
      })
      .sort((a, b) => {
        const ta = a.scheduledAtStart ? new Date(a.scheduledAtStart).getTime() : 0;
        const tb = b.scheduledAtStart ? new Date(b.scheduledAtStart).getTime() : 0;
        return tb - ta;
      });

    const wins = history.filter((h) => h.winnerTeamId === reg.id).length;
    const losses = history.filter((h) => h.winnerTeamId && h.winnerTeamId !== reg.id).length;

    // Next match (no finalizado)
    const { data: nmA } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, team_a_id, team_b_id, round_id")
      .eq("team_a_id", reg.id)
      .neq("status", "cancelled")
      .neq("status", "finished")
      .neq("status", "forfeit")
      .order("scheduled_at_start", { ascending: true, nullsFirst: false })
      .limit(1)) as { data: any };

    const { data: nmB } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, team_a_id, team_b_id, round_id")
      .eq("team_b_id", reg.id)
      .neq("status", "cancelled")
      .neq("status", "finished")
      .neq("status", "forfeit")
      .order("scheduled_at_start", { ascending: true, nullsFirst: false })
      .limit(1)) as { data: any };

    const nmCandidates: any[] = [];
    if (nmA && nmA.length > 0) nmCandidates.push(nmA[0]);
    if (nmB && nmB.length > 0) nmCandidates.push(nmB[0]);

    let nextMatch: NextMatchData | null = null;
    if (nmCandidates.length > 0) {
      const m = nmCandidates.sort((a, b) => {
        const ta = a.scheduled_at_start ? new Date(a.scheduled_at_start).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.scheduled_at_start ? new Date(b.scheduled_at_start).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      })[0];

      const isTeamA = m.team_a_id === reg.id;
      const opponentId = isTeamA ? m.team_b_id : m.team_a_id;
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
      if (m.round_id) {
        const { data: round } = (await supabase
          .from("round")
          .select("name")
          .eq("id", m.round_id)
          .maybeSingle()) as { data: any };
        if (round) roundName = round.name;
      }

      // Draw result
      let drawResult: NextMatchData["drawResult"] = null;
      const { data: games } = (await supabase
        .from("match_game")
        .select("id, game_number, draw_id, game_mode, antimeta_mode, player_mode, map, civs_a, civs_b")
        .eq("match_id", m.id)
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

      nextMatch = {
        id: m.id,
        status: m.status,
        scheduledAtStart: m.scheduled_at_start ?? null,
        scheduledAtEnd: m.scheduled_at_end ?? null,
        jornadaLabel: m.jornada_label ?? null,
        format: m.format ?? null,
        opponentName,
        opponentSeed,
        roundName,
        drawResult,
      };
    }

    return {
      teamAccount: {
        id: teamAccount?.id ?? reg.id,
        name: teamAccount?.name ?? "—",
        tagline: teamAccount?.tagline ?? null,
        emblemId: teamAccount?.emblem_id ?? null,
        emblemUrl: teamAccount?.emblem?.image_url ?? null,
      },
      edition: edition
        ? {
            name: edition.name ?? "—",
            eloCap: edition.elo_cap ?? 3500,
            eloTolerance: edition.elo_tolerance ?? 20,
          }
        : null,
      registration: {
        id: reg.id,
        seed: reg.seed ?? null,
        eloFreezeSnapshot: reg.elo_freeze_snapshot ?? null,
        baseCivIds: (reg.base_civ_ids as string[]) ?? [],
        extraCivIds: (reg.extra_civ_ids as string[]) ?? [],
        status: reg.status ?? "pending",
      },
      players,
      comodin,
      history,
      wins,
      losses,
      nextMatch,
    };
  } catch (e) {
    console.error("Error loading team:", e);
    return null;
  }
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "vertigo-badge-warning" },
  approved: { label: "Aprobado", cls: "vertigo-badge-success" },
  rejected: { label: "Rechazado", cls: "vertigo-badge-danger" },
};

export default async function EquipoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadTeam(id);
  if (!data) notFound();

  const eloMax = (data.edition?.eloCap ?? 3500) + (data.edition?.eloTolerance ?? 20);
  const isEloOk = !data.registration.eloFreezeSnapshot || data.registration.eloFreezeSnapshot <= eloMax;
  const statusMeta = STATUS_BADGE[data.registration.status] ?? STATUS_BADGE.pending;
  const emblemUrl = data.teamAccount.emblemUrl ?? null;
  const captain = data.players.find((p) => p.isCaptain) ?? null;
  const players = data.players;

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">REINO</span>
        </div>
        <div className="vertigo-header-right">
          <Link href="/equipos" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            ← Volver a equipos
          </Link>
        </div>
      </header>

      <main className="vertigo-content">
        {/* HEADER DEL REINO — banner cinematográfico con emblema real */}
        <div
          className="vertigo-card"
          style={{
            padding: 0,
            overflow: "hidden",
            marginBottom: 32,
            borderRadius: 16,
          }}
        >
          {/* Fondo: imagen de marca del torneo (guerrero con trofeo) */}
          <div
            style={{
              position: "relative",
              height: 200,
              backgroundImage: "url('/brand/hero-trofeo.png')",
              backgroundSize: "cover",
              backgroundPosition: "center 35%",
            }}
          >
            {/* Oscurecer para texto legible */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, rgba(7,3,16,0.35) 0%, rgba(7,3,16,0.85) 70%, #070310 100%)",
              }}
            />
            {/* Borde dorado inferior */}
            <div
              style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: 2,
                background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)",
              }}
            />
            {/* Contenido superpuesto */}
            <div
              style={{
                position: "relative", zIndex: 2,
                padding: "32px 32px 20px",
                display: "flex",
                alignItems: "flex-end",
                gap: 24,
                height: "100%",
                flexWrap: "wrap",
              }}
            >
              {/* Emblema */}
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 18,
                  overflow: "hidden",
                  border: `2px solid ${emblemUrl ? "rgba(212,175,55,0.55)" : "rgba(124,58,237,0.5)"}`,
                  background: "rgba(13,9,19,0.85)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 24px rgba(124,58,237,0.25)",
                  flexShrink: 0,
                }}
              >
                {emblemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={emblemUrl} alt={data.teamAccount.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Shield style={{ width: 40, height: 40, color: "var(--vertigo-purple-soft)", margin: "28px" }} strokeWidth={1.1} />
                )}
              </div>
              {/* Nombre y metadata */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10, letterSpacing: "3px", textTransform: "uppercase", color: "var(--vertigo-purple-soft)", marginBottom: 6, fontWeight: 700 }}>
                  Reino inscripto
                </div>
                <h1
                  style={{
                    fontFamily: "Cinzel, serif",
                    fontSize: "clamp(28px, 4vw, 44px)",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: "var(--vertigo-text)",
                    margin: 0,
                    textShadow: "0 4px 30px rgba(0,0,0,0.7)",
                  }}
                >
                  {data.teamAccount.name}
                </h1>
                {data.teamAccount.tagline && (
                  <p
                    style={{
                      fontSize: 14,
                      fontStyle: "italic",
                      color: "var(--vertigo-muted)",
                      margin: "8px 0 0 0",
                      maxWidth: 520,
                    }}
                  >
                    &ldquo;{data.teamAccount.tagline}&rdquo;
                  </p>
                )}
              </div>
              {/* Badges derecha */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginLeft: "auto" }}>
                {data.registration.seed != null && (
                  <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: 10, padding: "6px 14px" }}>
                    Seed #{data.registration.seed}
                  </span>
                )}
                <span className={`vertigo-badge ${statusMeta.cls}`} style={{ fontSize: 10, padding: "6px 14px" }}>
                  {statusMeta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Barra de datos clave debajo del banner */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 1,
              background: "var(--vertigo-line-soft)",
            }}
          >
            {[
              { label: "ELO TOTAL", value: data.registration.eloFreezeSnapshot ? data.registration.eloFreezeSnapshot.toLocaleString() : "—", accent: isEloOk ? "var(--vertigo-purple-pale)" : "var(--vertigo-danger)" },
              { label: "Capitán", value: captain?.displayName ?? "—", accent: "var(--vertigo-gold)" },
              { label: "Jugadores", value: `${players.length} / 3`, accent: "var(--vertigo-text)" },
              { label: "Civs", value: `${(data.registration.baseCivIds ?? []).length} + ${(data.registration.extraCivIds ?? []).length} extra`, accent: "var(--vertigo-text)" },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--vertigo-bg-elevated)", padding: "18px 24px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: 22, fontWeight: 700, color: s.accent, lineHeight: 1 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PRÓXIMA PARTIDA — REALTIME */}
        <div className="vertigo-subtitle">
          <Sparkles style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
          Próxima partida · en vivo
        </div>
        <div style={{ marginBottom: 32 }}>
          <TeamRealtimeWrapper
            teamRegistrationId={data.registration.id}
            initialNextMatch={data.nextMatch}
          />
        </div>

        {/* COMODINES */}
        {data.comodin && (
          <>
            <div className="vertigo-subtitle">
              <Swords style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
              Comodines disponibles
            </div>
            <div
              className="grid gap-3 mb-8"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
            >
              <ComodinCard label="Reroll" value={data.comodin.rerollAvailable} desc="Re-girar fase" />
              <ComodinCard label="Anular" value={data.comodin.anularAvailable} desc="Anular jugador rival" />
              <ComodinCard label="Elegir rival" value={data.comodin.elegirRivalAvailable} desc="Elegir oponente" />
              <ComodinCard label="Invocar PRO" value={data.comodin.invocarProAvailable} desc="Refuerzo profesional" />
            </div>
          </>
        )}

        {/* POOL DE CIVS */}
        {data.registration.baseCivIds.length > 0 && (
          <>
            <div className="vertigo-subtitle">
              <Swords style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
              Pool de civilizaciones
            </div>
            <div className="vertigo-card mb-8">
              <div className="flex flex-wrap gap-2 mb-5">
                {data.registration.baseCivIds.map((civId) => (
                  <span key={civId} className="vertigo-badge vertigo-badge-purple">
                    {civName(civId)}
                  </span>
                ))}
              </div>
              {data.registration.extraCivIds.length > 0 && (
                <>
                  <div className="vertigo-info-card-label" style={{ marginBottom: 10 }}>
                    <Trophy style={{ width: 11, height: 11 }} />
                    Civs extra (solo finalistas)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.registration.extraCivIds.map((civId) => (
                      <span key={civId} className="vertigo-badge vertigo-badge-warning">
                        {civName(civId)}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* JUGADORES */}
        <div className="vertigo-subtitle">
          <Users style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
          Jugadores
        </div>
        <div
          className="grid gap-3 mb-8"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
        >
          {data.players.map((p) => (
            <div key={p.id} className="vertigo-card">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex items-center justify-center flex-none rounded-full border-2 font-cinzel font-bold"
                  style={{
                    width: 44,
                    height: 44,
                    borderColor: p.isCaptain ? "var(--vertigo-purple)" : "var(--vertigo-line)",
                    color: p.isCaptain ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
                    fontSize: 18,
                  }}
                >
                  {p.displayName.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/jugadores/${p.id}`}
                    className="vertigo-link-card-title truncate block"
                    style={{ marginBottom: 2 }}
                  >
                    {p.displayName}
                  </Link>
                  <div className="text-[11px] text-[var(--vertigo-faint)] flex items-center gap-2 flex-wrap">
                    {p.isCaptain ? (
                      <>
                        <Crown style={{ width: 11, height: 11, color: "var(--vertigo-purple-soft)" }} />
                        Capitán
                      </>
                    ) : (
                      <>
                        <Star style={{ width: 11, height: 11 }} />
                        Jugador
                      </>
                    )}
                    {p.country && <span>· {p.country}</span>}
                    {p.clan && <span>· {p.clan}</span>}
                    {p.isVerified && (
                      <span className="vertigo-badge vertigo-badge-success" style={{ padding: "2px 8px", fontSize: 9 }}>
                        Verificado
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="vertigo-info-card">
                  <div className="vertigo-info-card-label">ELO máx</div>
                  <div className="vertigo-info-card-value">
                    {p.maxRatingRm1v1 ?? "—"}
                  </div>
                </div>
                <div className="vertigo-info-card">
                  <div className="vertigo-info-card-label">ELO actual</div>
                  <div className="vertigo-info-card-value">
                    {p.ratingRm1v1Current ?? "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* HISTORIAL */}
        <div className="vertigo-subtitle">
          <History style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
          Historial de partidos
        </div>
        {data.history.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <History
                style={{ width: 40, height: 40, color: "var(--vertigo-faint)", margin: "0 auto 12px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Sin partidos jugados</div>
              <p className="vertigo-empty-desc">
                Cuando este equipo dispute su primer partido, va a aparecer acá.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.history.map((m) => {
              const isWin = m.winnerTeamId === data.registration.id;
              const isLoss = m.winnerTeamId && m.winnerTeamId !== data.registration.id;
              const ourScore = m.isTeamA ? m.scoreA : m.scoreB;
              const oppScore = m.isTeamA ? m.scoreB : m.scoreA;
              return (
                <div key={m.id} className="vertigo-card">
                  <div className="vertigo-card-header">
                    <div>
                      <div className="vertigo-card-title">{m.roundName ?? "Partido"}</div>
                      {m.scheduledAtStart && (
                        <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">
                          {new Date(m.scheduledAtStart).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isWin && <span className="vertigo-badge vertigo-badge-success">Victoria</span>}
                      {isLoss && <span className="vertigo-badge vertigo-badge-danger">Derrota</span>}
                      {m.status === "disputed" && <span className="vertigo-badge vertigo-badge-warning">Disputa</span>}
                      {m.format && <span className="vertigo-badge vertigo-badge-purple">{m.format}</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[14px] font-medium text-[var(--vertigo-text)] truncate">
                        {data.teamAccount.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-none">
                      <span
                        className="font-cinzel text-2xl font-bold"
                        style={{ color: isWin ? "var(--vertigo-success)" : "var(--vertigo-text)" }}
                      >
                        {ourScore}
                      </span>
                      <span className="text-[var(--vertigo-faint)]">—</span>
                      <span
                        className="font-cinzel text-2xl font-bold"
                        style={{ color: isLoss ? "var(--vertigo-danger)" : "var(--vertigo-muted)" }}
                      >
                        {oppScore}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
                      <span className="text-[14px] font-medium text-[var(--vertigo-muted)] truncate">
                        {m.opponentName ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="vertigo-action-bar mt-4 pt-3 border-t border-[var(--vertigo-line-soft)]">
                    <Link href={`/partido/${m.id}`} className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
                      Ver partido →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ComodinCard({ label, value, desc }: { label: string; value: number; desc: string }) {
  const isAvailable = value > 0;
  return (
    <div className="vertigo-info-card">
      <div className="vertigo-info-card-label">{label}</div>
      <div className="vertigo-info-card-value" style={{ fontFamily: "var(--font-cinzel), Cinzel, serif", fontSize: 26 }}>
        <span style={{ color: isAvailable ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)" }}>
          {value}
        </span>
        <span className="text-[11px] text-[var(--vertigo-faint)] ml-2">disp.</span>
      </div>
      <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">{desc}</div>
    </div>
  );
}
