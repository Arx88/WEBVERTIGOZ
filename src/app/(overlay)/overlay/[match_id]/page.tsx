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

  return <StreamScreen match={data} />;
}
