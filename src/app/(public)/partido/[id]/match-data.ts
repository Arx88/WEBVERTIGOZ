/**
 * Módulo NEUTRO (sin "use client" / "use server") con el loader de partido.
 *
 * Se importa desde:
 *  - El Server Component de la página (carga inicial en el server)
 *  - El wrapper client (refresh por Realtime)
 *
 * Antes vivía dentro del archivo "use client" del wrapper, lo que hacía que
 * el import en el Server Component se convirtiera en una client-reference
 * en el build de producción y la promesa del server nunca resolviera el
 * loader (todo terminaba en "Partido no encontrado").
 */

export interface GameView {
  id: string;
  gameNumber: number;
  status: string;
  gameMode: string | null;
  antimetaMode: string | null;
  playerMode: string | null;
  map: string | null;
  civsA: string[];
  civsB: string[];
  winnerTeamId: string | null;
  replayUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  drawResult: {
    gameMode?: string;
    antimetaMode?: string;
    playerMode?: string;
    map?: string;
    civsA?: string[];
    civsB?: string[];
  } | null;
}

export interface MatchData {
  id: string;
  status: string;
  format: string | null;
  scheduledAtStart: string | null;
  scheduledAtEnd: string | null;
  jornadaLabel: string | null;
  roundName: string | null;
  teamA: {
    id: string;
    name: string;
    seed: number | null;
  } | null;
  teamB: {
    id: string;
    name: string;
    seed: number | null;
  } | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  // READY #1 / READY #2 y ventana de comodines (para el panel del capitán)
  readyA: boolean;
  readyB: boolean;
  readyLineupA: boolean;
  readyLineupB: boolean;
  comodinWindowExpiresAt: string | null;
  streamEmbedEnabled: boolean;
  streamCaster: {
    displayName: string;
    twitchChannel: string | null;
    youtubeChannel: string | null;
    kickChannel: string | null;
  } | null;
  comodinUsages: {
    id: string;
    comodinType: string;
    status: string;
    teamName: string | null;
    notes: string | null;
  }[];
  games: GameView[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMatch(supabase: any, matchId: string): Promise<MatchData | null> {
  const { data: match } = (await supabase
    .from("match")
    .select(
      "id, status, format, scheduled_at_start, scheduled_at_end, jornada_label, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id, stream_caster_id, stream_embed_enabled, ready_a_at, ready_b_at, ready_lineup_a_at, ready_lineup_b_at, comodin_window_expires_at"
    )
    .eq("id", matchId)
    .maybeSingle()) as { data: any };

  if (!match) return null;

  // Team A
  let teamA: MatchData["teamA"] = null;
  if (match.team_a_id) {
    const { data: ta } = (await supabase
      .from("team_registration")
      .select("id, seed, team_account:team_account_id ( name )")
      .eq("id", match.team_a_id)
      .maybeSingle()) as { data: any };
    if (ta) {
      teamA = {
        id: ta.id,
        name: ta.team_account?.name ?? "—",
        seed: ta.seed ?? null,
      };
    }
  }

  // Team B
  let teamB: MatchData["teamB"] = null;
  if (match.team_b_id) {
    const { data: tb } = (await supabase
      .from("team_registration")
      .select("id, seed, team_account:team_account_id ( name )")
      .eq("id", match.team_b_id)
      .maybeSingle()) as { data: any };
    if (tb) {
      teamB = {
        id: tb.id,
        name: tb.team_account?.name ?? "—",
        seed: tb.seed ?? null,
      };
    }
  }

  // Round
  let roundName: string | null = null;
  if (match.round_id) {
    const { data: round } = (await supabase
      .from("round")
      .select("name")
      .eq("id", match.round_id)
      .maybeSingle()) as { data: any };
    if (round) roundName = round.name;
  }

  // Caster
  let streamCaster: MatchData["streamCaster"] = null;
  if (match.stream_caster_id) {
    const { data: caster } = (await supabase
      .from("caster")
      .select("display_name, twitch_channel, youtube_channel, kick_channel")
      .eq("id", match.stream_caster_id)
      .maybeSingle()) as { data: any };
    if (caster) {
      streamCaster = {
        displayName: caster.display_name ?? "—",
        twitchChannel: caster.twitch_channel ?? null,
        youtubeChannel: caster.youtube_channel ?? null,
        kickChannel: caster.kick_channel ?? null,
      };
    }
  }

  // Games
  const { data: gamesRaw } = (await supabase
    .from("match_game")
    .select("id, game_number, status, game_mode, antimeta_mode, player_mode, map, civs_a, civs_b, winner_team_id, replay_url, started_at, finished_at, draw_id")
    .eq("match_id", matchId)
    .order("game_number", { ascending: true })) as { data: any };

  const games: GameView[] = [];
  for (const g of gamesRaw ?? []) {
    let drawResult: GameView["drawResult"] = null;
    if (g.draw_id) {
      const { data: draw } = (await supabase
        .from("roulette_draw")
        .select("result, status")
        .eq("id", g.draw_id)
        .maybeSingle()) as { data: any };
      if (draw && draw.result) {
        const r = draw.result as any;
        drawResult = {
          gameMode: r.gameMode,
          antimetaMode: r.antimetaMode,
          playerMode: r.playerMode,
          map: r.map,
          civsA: r.civsA,
          civsB: r.civsB,
        };
      }
    }
    games.push({
      id: g.id,
      gameNumber: g.game_number,
      status: g.status,
      gameMode: g.game_mode ?? null,
      antimetaMode: g.antimeta_mode ?? null,
      playerMode: g.player_mode ?? null,
      map: g.map ?? null,
      civsA: (g.civs_a as string[]) ?? [],
      civsB: (g.civs_b as string[]) ?? [],
      winnerTeamId: g.winner_team_id ?? null,
      replayUrl: g.replay_url ?? null,
      startedAt: g.started_at ?? null,
      finishedAt: g.finished_at ?? null,
      drawResult,
    });
  }

  // Comodín usages
  const { data: comodinRaw } = (await supabase
    .from("comodin_usage")
    .select("id, comodin_type, status, notes, comodin_inventory_id")
    .eq("match_id", matchId)
    .order("requested_at", { ascending: true })) as { data: any };

  // Para cada uso, traer el team name (via comodin_inventory)
  const invIds: string[] = (comodinRaw ?? [])
    .map((c: any) => c.comodin_inventory_id)
    .filter(Boolean);
  let invToTeam: Record<string, string> = {};
  if (invIds.length > 0) {
    const { data: invs } = (await supabase
      .from("comodin_inventory")
      .select("id, team_registration_id")
      .in("id", invIds)) as { data: any };
    const regIds: string[] = (invs ?? []).map((i: any) => i.team_registration_id).filter(Boolean);
    let regToName: Record<string, string> = {};
    if (regIds.length > 0) {
      const { data: regs } = (await supabase
        .from("team_registration")
        .select("id, team_account:team_account_id ( name )")
        .in("id", regIds)) as { data: any };
      for (const r of regs ?? []) {
        regToName[r.id] = r.team_account?.name ?? "—";
      }
    }
    for (const i of invs ?? []) {
      invToTeam[i.id] = regToName[i.team_registration_id] ?? "—";
    }
  }

  const comodinUsages: MatchData["comodinUsages"] = (comodinRaw ?? []).map((c: any) => ({
    id: c.id,
    comodinType: c.comodin_type,
    status: c.status,
    teamName: c.comodin_inventory_id ? invToTeam[c.comodin_inventory_id] ?? null : null,
    notes: c.notes ?? null,
  }));

  return {
    id: match.id,
    status: match.status,
    format: match.format ?? null,
    scheduledAtStart: match.scheduled_at_start ?? null,
    scheduledAtEnd: match.scheduled_at_end ?? null,
    jornadaLabel: match.jornada_label ?? null,
    roundName,
    teamA,
    teamB,
    scoreA: match.score_a ?? 0,
    scoreB: match.score_b ?? 0,
    winnerTeamId: match.winner_team_id ?? null,
    readyA: !!match.ready_a_at,
    readyB: !!match.ready_b_at,
    readyLineupA: !!match.ready_lineup_a_at,
    readyLineupB: !!match.ready_lineup_b_at,
    comodinWindowExpiresAt: match.comodin_window_expires_at ?? null,
    streamEmbedEnabled: !!match.stream_embed_enabled,
    streamCaster,
    comodinUsages,
    games,
  };
}
