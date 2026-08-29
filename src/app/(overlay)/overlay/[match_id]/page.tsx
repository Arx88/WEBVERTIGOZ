import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
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
      ready_a_at, ready_b_at, score_a, score_b, winner_team_id,
      round:round_id (name),
      team_a:team_a_id (id, team_account:team_account_id (name, emblem:emblem_id (image_url))),
      team_b:team_b_id (id, team_account:team_account_id (name, emblem:emblem_id (image_url)))
    `)
    .eq("id", match_id)
    .single()) as { data: any };

  if (!match) notFound();

  // Partidas 2/3 de un BO3: el match queda "in_progress" pero la partida
  // activa vuelve a "drawing" para el re-sorteo. La stream debe mostrar la
  // ruleta igual, así que se expone el estado de la partida más reciente.
  const { data: games } = (await supabase
    .from("match_game")
    .select("game_number, status")
    .eq("match_id", match_id)
    .order("game_number", { ascending: true })) as { data: any[] };

  const activeGame = games?.length ? games[games.length - 1] : null;

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
    teamA: match.team_a
      ? {
          id: match.team_a.id,
          name: match.team_a.team_account?.name ?? "Equipo A",
          emblemUrl: match.team_a.team_account?.emblem?.image_url ?? null,
        }
      : null,
    teamB: match.team_b
      ? {
          id: match.team_b.id,
          name: match.team_b.team_account?.name ?? "Equipo B",
          emblemUrl: match.team_b.team_account?.emblem?.image_url ?? null,
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
