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
  /** Lineups declarados por cada equipo (player_ids) y su civ por jugador. */
  lineupA: string[];
  lineupB: string[];
  civAssignA: Record<string, string>;
  civAssignB: Record<string, string>;
  /** Sync con AoE2 Companion (liviano: solo flags para decidir qué mostrar).
      El payload pesado del análisis se busca on-demand vía /api/replays/analysis. */
  aoe2: {
    matchId: number | null;
    syncStatus: string;
    hasRec: boolean;
    hasAnalysis: boolean;
  } | null;
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
  /** Posición de la llave en su ronda (para derivar el nombre de sala AoE2). */
  slotIndex: number;
  scheduledAtStart: string | null;
  scheduledAtEnd: string | null;
  jornadaLabel: string | null;
  roundName: string | null;
  teamA: {
    id: string;
    name: string;
    seed: number | null;
    emblemUrl: string | null;
  } | null;
  teamB: {
    id: string;
    name: string;
    seed: number | null;
    emblemUrl: string | null;
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
    /** team_registration del equipo que lo pidió — para la exclusión mutua
        anular↔elegir_rival del panel del capitán (misma regla que el server:
        usage del otro tipo con status ∉ {cancelled, revoked}). */
    teamRegId: string | null;
    notes: string | null;
  }[];
  games: GameView[];
  /** Partida de mayor game_number (la activa/última) — para el panel del capitán. */
  activeGame: GameView | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMatch(supabase: any, matchId: string): Promise<MatchData | null> {
  const { data: match } = (await supabase
    .from("match")
    .select(
      "id, status, format, slot_index, scheduled_at_start, scheduled_at_end, jornada_label, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id, stream_caster_id, stream_embed_enabled, ready_a_at, ready_b_at, ready_lineup_a_at, ready_lineup_b_at, comodin_window_expires_at"
    )
    .eq("id", matchId)
    .maybeSingle()) as { data: any };

  if (!match) return null;

  // ─────────────────────────────────────────────────────────────
  // Tanda 1 EN PARALELO: equipos, ronda, caster, games y comodines.
  // Antes corrían en serie (6 round-trips secuenciales a Supabase) y
  // cada uno sumaba su latencia al TTFB de la página de partido.
  // ─────────────────────────────────────────────────────────────
  const [teamARow, teamBRow, roundRow, casterRow, gamesRaw, comodinRaw] = (await Promise.all([
    match.team_a_id
      ? supabase
          .from("team_registration")
          .select("id, seed, team_account:team_account_id ( name, emblem_id, emblem:emblem_id ( image_url ) )")
          .eq("id", match.team_a_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    match.team_b_id
      ? supabase
          .from("team_registration")
          .select("id, seed, team_account:team_account_id ( name, emblem_id, emblem:emblem_id ( image_url ) )")
          .eq("id", match.team_b_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    match.round_id
      ? supabase.from("round").select("name").eq("id", match.round_id).maybeSingle()
      : Promise.resolve({ data: null }),
    match.stream_caster_id
      ? supabase
          .from("caster")
          .select("display_name, twitch_channel, youtube_channel, kick_channel")
          .eq("id", match.stream_caster_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("match_game")
      .select("id, game_number, status, game_mode, antimeta_mode, player_mode, map, civs_a, civs_b, winner_team_id, replay_url, started_at, finished_at, draw_id, aoe2_match_id, aoe2_sync_status, rec_storage_path, lineup_a, lineup_b, civ_assignment_a, civ_assignment_b")
      .eq("match_id", matchId)
      .order("game_number", { ascending: true }),
    supabase
      .from("comodin_usage")
      .select("id, comodin_type, status, notes, comodin_inventory_id")
      .eq("match_id", matchId)
      .order("requested_at", { ascending: true }),
  ])) as { data: any }[];

  const teamOf = (row: any): MatchData["teamA"] =>
    row
      ? {
          id: row.id,
          name: row.team_account?.name ?? "—",
          seed: row.seed ?? null,
          emblemUrl: row.team_account?.emblem?.image_url ?? null,
        }
      : null;
  const teamA = teamOf(teamARow?.data);
  const teamB = teamOf(teamBRow?.data);
  const roundName: string | null = roundRow?.data?.name ?? null;
  const streamCaster: MatchData["streamCaster"] = casterRow?.data
    ? {
        displayName: casterRow.data.display_name ?? "—",
        twitchChannel: casterRow.data.twitch_channel ?? null,
        youtubeChannel: casterRow.data.youtube_channel ?? null,
        kickChannel: casterRow.data.kick_channel ?? null,
      }
    : null;

  // ─────────────────────────────────────────────────────────────
  // Tanda 2 EN PARALELO: análisis por game (tabla de lectura pública,
  // funciona igual con el cliente anon del browser) e inventario de
  // comodines. Ambas dependen solo de la tanda 1.
  // ─────────────────────────────────────────────────────────────
  const gameIds: string[] = (gamesRaw?.data ?? []).map((g: any) => g.id);
  const invIds: string[] = (comodinRaw?.data ?? [])
    .map((c: any) => c.comodin_inventory_id)
    .filter(Boolean);
  const [analysisRows, invs] = (await Promise.all([
    gameIds.length > 0
      ? supabase.from("match_game_analysis").select("match_game_id").in("match_game_id", gameIds)
      : Promise.resolve({ data: null }),
    invIds.length > 0
      ? supabase.from("comodin_inventory").select("id, team_registration_id").in("id", invIds)
      : Promise.resolve({ data: null }),
  ])) as { data: any }[];

  const analysisSet = new Set<string>();
  for (const r of analysisRows?.data ?? []) analysisSet.add(r.match_game_id);

  const regIds: string[] = (invs?.data ?? []).map((i: any) => i.team_registration_id).filter(Boolean);
  const drawIds: string[] = (gamesRaw?.data ?? []).map((g: any) => g.draw_id).filter(Boolean);

  // ─────────────────────────────────────────────────────────────
  // Tanda 3 EN PARALELO: nombres de equipos de comodines + resultados
  // de sorteos. Los draws van en UNA query `in` (antes: una query por
  // partida, en serie dentro del loop).
  // ─────────────────────────────────────────────────────────────
  const [regs, draws] = (await Promise.all([
    regIds.length > 0
      ? supabase.from("team_registration").select("id, team_account:team_account_id ( name )").in("id", regIds)
      : Promise.resolve({ data: null }),
    drawIds.length > 0
      ? supabase.from("roulette_draw").select("id, result, status").in("id", drawIds)
      : Promise.resolve({ data: null }),
  ])) as { data: any }[];

  const regToName: Record<string, string> = {};
  for (const r of regs?.data ?? []) {
    regToName[r.id] = r.team_account?.name ?? "—";
  }
  const invToTeam: Record<string, string> = {};
  const invToReg: Record<string, string> = {};
  for (const i of invs?.data ?? []) {
    invToTeam[i.id] = regToName[i.team_registration_id] ?? "—";
    invToReg[i.id] = i.team_registration_id ?? "";
  }
  const drawById = new Map<string, any>();
  for (const d of draws?.data ?? []) drawById.set(d.id, d);

  const games: GameView[] = [];
  for (const g of gamesRaw?.data ?? []) {
    let drawResult: GameView["drawResult"] = null;
    const draw = g.draw_id ? drawById.get(g.draw_id) : null;
    if (draw && draw.result) {
      const r = draw.result as any;
      // El result guarda cada fase como objeto PresetMode completo
      // ({ id, title, … }); el GameView espera el título para display.
      const title = (v: any): string | undefined =>
        v == null ? undefined : typeof v === "object" ? v.title ?? undefined : String(v);
      drawResult = {
        gameMode: title(r.gameMode),
        antimetaMode: title(r.antimetaMode),
        playerMode: title(r.playerMode),
        map: title(r.map),
        civsA: r.civsA,
        civsB: r.civsB,
      };
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
      lineupA: (g.lineup_a as string[]) ?? [],
      lineupB: (g.lineup_b as string[]) ?? [],
      civAssignA: (g.civ_assignment_a as Record<string, string>) ?? {},
      civAssignB: (g.civ_assignment_b as Record<string, string>) ?? {},
      aoe2: {
        matchId: g.aoe2_match_id ?? null,
        syncStatus: g.aoe2_sync_status ?? "pending",
        hasRec: !!g.rec_storage_path,
        hasAnalysis: analysisSet.has(g.id),
      },
      drawResult,
    });
  }

  const comodinUsages: MatchData["comodinUsages"] = (comodinRaw?.data ?? []).map((c: any) => ({
    id: c.id,
    comodinType: c.comodin_type,
    status: c.status,
    teamName: c.comodin_inventory_id ? invToTeam[c.comodin_inventory_id] ?? null : null,
    teamRegId: c.comodin_inventory_id ? invToReg[c.comodin_inventory_id] ?? null : null,
    notes: c.notes ?? null,
  }));

  return {
    id: match.id,
    status: match.status,
    format: match.format ?? null,
    slotIndex: match.slot_index ?? 0,
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
    // Partida activa: la de mayor game_number que no terminó
    // (sirve para el panel del capitán: player_mode define cuántos juegan).
    activeGame: (games.length > 0 ? games.reduce((a, b) => (b.gameNumber > a.gameNumber ? b : a)) : null) as GameView | null,
  };
}
