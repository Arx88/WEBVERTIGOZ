import { notFound } from "next/navigation";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import StreamScreen, { type StreamMatchData } from "./stream-screen";

export const dynamic = "force-dynamic";

/**
 * VISTA STREAM — pantalla para el Browser Source de OBS.
 *
 * Sin nav ni chrome del sitio: escena completa con los dos escudos, el
 * estado de READY de cada equipo y la cuenta de la ventana. El admin la
 * abre desde el centro de operaciones del partido y la captura en OBS.
 *
 * El admin ve un botón "INICIAR SORTEO" (solo si tiene sesión): el sorteo
 * arranca DESDE la stream, no desde el panel. OBS no tiene sesión, así que
 * el botón nunca aparece en la captura.
 */
export default async function OverlayMatchPage({
  params,
}: {
  params: Promise<{ match_id: string }>;
}) {
  const { match_id } = await params;
  const supabase = (await getSupabaseServer()) as any;

  // Lectura pública: match/team_registration/round tienen SELECT abierto.
  const { data: match } = (await supabase
    .from("match")
    .select(`
      id, status, format, scheduled_at_start, jornada_label,
      ready_a_at, ready_b_at, ready_lineup_a_at, ready_lineup_b_at,
      comodin_window_expires_at, score_a, score_b, winner_team_id,
      round:round_id (name),
      team_a:team_a_id (id, team_account:team_account_id (name, emblem:emblem_id (image_url)),
        players:player_registration (id, display_name, is_captain)),
      team_b:team_b_id (id, team_account:team_account_id (name, emblem:emblem_id (image_url)),
        players:player_registration (id, display_name, is_captain))
    `)
    .eq("id", match_id)
    .single()) as { data: any };

  if (!match) notFound();

  // Partidas 2/3 de un BO3: el match queda "in_progress" pero la partida
  // activa vuelve a "drawing" para el re-sorteo. La stream debe mostrar la
  // ruleta igual, así que se expone el estado de la partida más reciente.
  const { data: games } = (await supabase
    .from("match_game")
    .select("id, game_number, status, game_mode, player_mode, map, civs_a, civs_b, lineup_a, lineup_b, civ_assignment_a, civ_assignment_b, aoe2_sync_status, started_at")
    .eq("match_id", match_id)
    .order("game_number", { ascending: true })) as { data: any[] };

  const activeGame = games?.length ? games[games.length - 1] : null;

  // Comodines ejecutados (el capitán los usa al instante; el admin queda
  // solo para el sorteo): el stream dispara la carta épica con cada INSERT.
  // Lectura anónima — comodin_usage es visible, pero comodin_inventory NO
  // (RLS) así que el equipo se resuelve acá con los team_ids del match: se
  // mira cuál inventario pertenece a qué equipo por el inventario del usage.
  const { data: executedUsages } = (await supabase
    .from("comodin_usage")
    .select(`
      id, comodin_type, comodin_inventory_id, executed_at,
      target:target_player_id (display_name)
    `)
    .eq("match_id", match_id)
    .eq("status", "executed")
    .order("executed_at", { ascending: true })) as { data: any[] };
  // Mapa inventario → team del match. comodin_inventory está detrás de RLS
  // para anónimos (OBS), así que se lee con service role — mismo patrón que
  // match-data.ts para los usages del panel del capitán. Solo IDs, nada sensible.
  const invIds = (executedUsages ?? []).map((c: any) => c.comodin_inventory_id).filter(Boolean);
  const service = getSupabaseServiceRole() as any;
  const inventories = invIds.length
    ? ((await service
        .from("comodin_inventory")
        .select("id, team_registration_id")
        .in("id", invIds)) as { data: any[] }).data ?? []
    : [];
  const invToTeam: Record<string, string> = {};
  for (const i of inventories) invToTeam[i.id] = i.team_registration_id;

  // Próxima partida a sortear (la dispara el admin desde la propia stream):
  //  - P1 cuando no hay sorteo todavía (scheduled/open y la P1 sigue pending).
  //  - P2/P3 cuando el BO3 quedó 1-1 y la siguiente partida sigue "pending".
  const firstGame = games?.find((g: any) => g.game_number === 1) ?? null;
  const firstDrawable =
    (match.status === "scheduled" || match.status === "open") &&
    (!firstGame || firstGame.status === "pending");
  const nextPending = games?.find(
    (g: any) => g.game_number > 1 && g.status === "pending"
  ) ?? null;
  const nextDrawGameNumber = firstDrawable
    ? 1
    : match.status === "in_progress" && nextPending
    ? nextPending.game_number
    : null;

  // ¿El viewer es admin? Solo el admin ve el botón INICIAR SORTEO en la
  // stream. OBS (sin sesión) nunca lo ve.
  let isAdmin = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: account } = (await supabase
        .from("account")
        .select("role")
        .eq("supabase_auth_id", user.id)
        .maybeSingle()) as { data: any };
      isAdmin = !!account && ["admin", "super_admin"].includes(account.role);
    }
  } catch {
    // Sin sesión o Supabase caído: el viewer ve la stream igual (sin botón).
  }

  const data: StreamMatchData = {
    id: match.id,
    status: match.status,
    format: match.format ?? null,
    scheduledAtStart: match.scheduled_at_start ?? null,
    jornadaLabel: match.jornada_label ?? null,
    readyAAt: match.ready_a_at ?? null,
    readyBAt: match.ready_b_at ?? null,
    scoreA: match.score_a ?? 0,
    scoreB: match.score_b ?? 0,
    winnerTeamId: match.winner_team_id ?? null,
    roundName: match.round?.name ?? null,
    activeGameDrawing: activeGame?.status === "drawing",
    /** Corroboración de que la partida EXISTE en AoE2: el sync busca la
        sala por nombre; mientras no la encuentre, "en juego" es solo la
        intención del bracket, no un hecho. */
    activeGameSyncStatus: activeGame?.aoe2_sync_status ?? null,
    activeGameStartedAt: activeGame?.started_at ?? null,
    /** Sorteo de la partida activa (chips tras la ruleta + board de lineup):
        lo que el stream necesita para MOSTRAR el resultado, no solo decir la fase. */
    activeDraw: activeGame
      ? {
          gameNumber: activeGame.game_number,
          status: activeGame.status,
          gameMode: activeGame.game_mode ?? null,
          playerMode: activeGame.player_mode ?? null,
          map: activeGame.map ?? null,
          civsA: (activeGame.civs_a as string[]) ?? [],
          civsB: (activeGame.civs_b as string[]) ?? [],
          lineupA: (activeGame.lineup_a as string[]) ?? [],
          lineupB: (activeGame.lineup_b as string[]) ?? [],
          civAssignA: (activeGame.civ_assignment_a as Record<string, string>) ?? {},
          civAssignB: (activeGame.civ_assignment_b as Record<string, string>) ?? {},
        }
      : null,
    readyLineupAAt: match.ready_lineup_a_at ?? null,
    readyLineupBAt: match.ready_lineup_b_at ?? null,
    comodinWindowExpiresAt: match.comodin_window_expires_at ?? null,
    /** Comodines ya ejecutados (capitán al instante): la carta épica del
        stream sale cuando esta lista cambia (INSERT por realtime → refresh). */
    executedComodins: (executedUsages ?? []).map((c: any) => ({
      id: c.id,
      comodinType: c.comodin_type,
      /** Registro del equipo que lo usó (para el estandarte de la carta). */
      teamRegId: invToTeam[c.comodin_inventory_id] ?? null,
      targetName: c.target?.display_name ?? null,
    })),
    teamA: match.team_a
      ? {
          id: match.team_a.id,
          name: match.team_a.team_account?.name ?? "Equipo A",
          emblemUrl: match.team_a.team_account?.emblem?.image_url ?? null,
          players: (match.team_a.players ?? []).map((p: any) => ({ id: p.id, name: p.display_name, isCaptain: !!p.is_captain })),
        }
      : null,
    teamB: match.team_b
      ? {
          id: match.team_b.id,
          name: match.team_b.team_account?.name ?? "Equipo B",
          emblemUrl: match.team_b.team_account?.emblem?.image_url ?? null,
          players: (match.team_b.players ?? []).map((p: any) => ({ id: p.id, name: p.display_name, isCaptain: !!p.is_captain })),
        }
      : null,
  };

  return (
    <StreamScreen
      match={data}
      isAdmin={isAdmin}
      nextDrawGameNumber={nextDrawGameNumber}
    />
  );
}
