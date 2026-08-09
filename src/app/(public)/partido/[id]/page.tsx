import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { civName } from "@/lib/constants/civs";
import MatchRealtimeWrapper from "./match-realtime-wrapper";

export const dynamic = "force-dynamic";

async function getMatchPublic(matchId: string) {
  const supabase = (await getSupabaseServer()) as any;

  // Match + round
  const { data: match } = (await supabase
    .from("match")
    .select(`
      id, status, slot_index, scheduled_at_start, scheduled_at_end, jornada_label,
      team_a_id, team_b_id, winner_team_id, score_a, score_b, format,
      ready_a_at, ready_b_at, ready_lineup_a_at, ready_lineup_b_at,
      finished_at, stream_caster_id, stream_embed_enabled,
      round:round_id (id, name, index)
    `)
    .eq("id", matchId)
    .single()) as { data: any };

  if (!match) return null;

  // Teams
  const teamIds = [match.team_a_id, match.team_b_id].filter(Boolean);
  let teamsMap: Record<string, any> = {};

  if (teamIds.length > 0) {
    const { data: teamsData } = (await supabase
      .from("team_registration")
      .select(`
        id, seed, elo_freeze_snapshot,
        team_account:team_account_id (id, name, tagline, emblem_id)
      `)
      .in("id", teamIds)) as { data: any[] };

    teamsData?.forEach((t) => {
      teamsMap[t.id] = t;
    });

    // Players de cada team
    for (const teamId of teamIds) {
      const { data: players } = (await supabase
        .from("player_registration")
        .select("id, display_name, is_captain, max_rating_rm_1v1, aoe2_profile_id")
        .eq("team_registration_id", teamId)
        .order("is_captain", { ascending: false })) as { data: any[] };
      teamsMap[teamId].players = players ?? [];
    }
  }

  // Match games
  const { data: games } = (await supabase
    .from("match_game")
    .select(`
      id, game_number, status, game_mode, antimeta_mode, player_mode, map,
      civs_a, civs_b, lineup_a, lineup_b, winner_team_id, started_at, finished_at,
      draw_id
    `)
    .eq("match_id", matchId)
    .order("game_number", { ascending: true })) as { data: any[] };

  // Draws
  const drawIds = (games ?? []).map((g: any) => g.draw_id).filter(Boolean);
  let drawsMap: Record<string, any> = {};
  if (drawIds.length > 0) {
    const { data: drawsData } = (await supabase
      .from("roulette_draw")
      .select("id, status, commit_hash, revealed_seed, public_inputs, result, committed_at, published_at")
      .in("id", drawIds)) as { data: any[] };
    drawsData?.forEach((d) => {
      drawsMap[d.id] = d;
    });
  }

  // Caster (si asignado)
  let caster: any = null;
  if (match.stream_caster_id) {
    const { data: casterData } = (await supabase
      .from("caster")
      .select("id, name, channel_url, platform")
      .eq("id", match.stream_caster_id)
      .single()) as { data: any };
    caster = casterData;
  }

  // Comodin usages en este match
  const { data: comodinUsages } = (await supabase
    .from("comodin_usage")
    .select(`
      id, comodin_type, executed_at,
      comodin_inventory:comodin_inventory_id (team_registration_id)
    `)
    .eq("match_id", matchId)
    .order("executed_at", { ascending: true })) as { data: any[] };

  return {
    match,
    teamsMap,
    games: games ?? [],
    drawsMap,
    caster,
    comodinUsages: comodinUsages ?? [],
  };
}

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMatchPublic(id);

  if (!data) {
    notFound();
  }

  const { match, teamsMap, games, drawsMap, caster, comodinUsages } = data;

  const teamA = match.team_a_id ? teamsMap[match.team_a_id] : null;
  const teamB = match.team_b_id ? teamsMap[match.team_b_id] : null;

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <Link href="/bracket" style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver al bracket
        </Link>
      </div>

      {/* MATCH REALTIME WRAPPER */}
      <MatchRealtimeWrapper
        matchId={match.id}
        initialMatch={match}
        initialTeamA={teamA}
        initialTeamB={teamB}
        initialGames={games}
        initialDrawsMap={drawsMap}
        caster={caster}
        comodinUsages={comodinUsages}
      />
    </main>
  );
}
