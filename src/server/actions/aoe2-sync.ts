"use server";

/**
 * VÉRTIGO Cup — Vínculo forzado de una partida de AoE2 Companion.
 *
 * El watcher descubre las partidas solo por el nombre de sala. Si los
 * jugadores usaron otro nombre o las cuentas no coinciden, el admin
 * puede pegar acá la URL (o id) de Companion y ejecutar el MISMO
 * pipeline de sync sobre ese match: valida mapa/modo/ganador, archiva
 * rec + análisis y auto-reporta el resultado.
 *
 * El formulario de reporte manual sigue disponible como último recurso.
 */

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { requireAdminAccount } from "./match-day";
import { parseCompanionMatchRef } from "@/lib/aoe2/lobby-name";
import { syncGameWithCompanion, type SyncGameRow, type SyncMatchRow } from "@/lib/aoe2/match-sync";

export async function linkAoe2MatchAction(formData: FormData): Promise<{ ok: boolean; error?: string; detail?: string }> {
  await requireAdminAccount();

  const matchGameId = String(formData.get("match_game_id") ?? "").trim();
  const ref = String(formData.get("companion_ref") ?? "").trim();
  if (!matchGameId || !ref) return { ok: false, error: "Faltan campos." };

  const aoe2MatchId = parseCompanionMatchRef(ref);
  if (!aoe2MatchId) {
    return { ok: false, error: "No pude interpretar la referencia. Pegá el id numérico o la URL de aoe2companion.com del match." };
  }

  const service = getSupabaseServiceRole() as any;
  const { data: game } = (await service
    .from("match_game")
    .select("id, match_id, game_number, status, game_mode, player_mode, map, lineup_a, lineup_b, started_at, aoe2_match_id, aoe2_sync_status, aoe2_checked_at, aoe2_flag, rec_storage_path, match:match_id(id, status, jornada_label, slot_index, team_a_id, team_b_id)")
    .eq("id", matchGameId).single()) as { data: any };
  if (!game) return { ok: false, error: "Partida no encontrada." };
  const match = game.match;
  if (!match) return { ok: false, error: "Match padre no encontrado." };
  if (game.status === "finished") return { ok: false, error: "Esta partida ya está finalizada — usá el reporte manual si hay que corregir algo." };
  if (game.aoe2_sync_status === "synced") return { ok: false, error: "Esta partida ya está sincronizada con Companion." };

  const matchRow: SyncMatchRow = {
    id: match.id,
    status: match.status,
    jornada_label: match.jornada_label,
    slot_index: match.slot_index,
    team_a_id: match.team_a_id,
    team_b_id: match.team_b_id,
  };
  const { match: _drop, ...gameRow } = game;
  const result = await syncGameWithCompanion(service, matchRow, gameRow as SyncGameRow, {
    forceAoe2MatchId: Number(aoe2MatchId),
  });

  revalidatePath(`/partido/${match.id}`);
  revalidatePath(`/admin/partido/${match.id}`);

  if (result.reported) {
    return { ok: true, detail: `Match ${aoe2MatchId} vinculado: rec y análisis archivados, resultado cargado.` };
  }
  return {
    ok: false,
    error: result.flag ?? "No se pudo vincular ese match (revisá que corresponda a esta partida).",
  };
}

/** Wrapper <form>: tira el error para que el admin lo vea. */
export async function linkAoe2MatchFormAction(formData: FormData): Promise<void> {
  const r = await linkAoe2MatchAction(formData);
  if (!r.ok) throw new Error(r.error ?? "No se pudo vincular.");
}
