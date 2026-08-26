import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { refreshPlayerStatsCache, type PlayerRef } from "@/lib/aoe2/stats-cache";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/refresh-stats?limit=25
 *
 * Refresca el cache de stats Companion (rm_team) de los jugadores de
 * equipos aprobados que estén vencidos (>7 días) o sin fila.
 * Procesa en tandas para respetar el rate limit de Companion;
 * corridas sucesivas van cubriendo el resto.
 * Pensado para un cron externo (Vercel Cron, GitHub Action, etc.):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/refresh-stats
 * Sin CRON_SECRET configurado, solo se permite en desarrollo.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "no autorizado" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 401 }
    );
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 25) || 25, 100);
  const admin = getSupabaseServiceRole() as any;

  // Jugadores de inscripciones aprobadas
  const { data: regs } = await admin
    .from("team_registration")
    .select("id")
    .eq("status", "approved");
  const regIds = (regs ?? []).map((r: any) => r.id);
  if (regIds.length === 0) return NextResponse.json({ refreshed: 0, players: 0 });

  const all: PlayerRef[] = [];
  for (let i = 0; i < regIds.length; i += 50) {
    const { data: ps } = await admin
      .from("player_registration")
      .select("id, aoe2_profile_id")
      .in("team_registration_id", regIds.slice(i, i + 50));
    for (const p of ps ?? []) {
      all.push({ playerRegistrationId: p.id, aoe2ProfileId: p.aoe2_profile_id });
    }
  }

  // Cuáles están vencidos o sin fila (>7 días)
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: cachedRows } = await admin
    .from("player_stats_cache")
    .select("aoe2_profile_id, fetched_at");
  const freshIds = new Set(
    (cachedRows ?? [])
      .filter((r: any) => r.fetched_at && r.fetched_at > cutoff)
      .map((r: any) => r.aoe2_profile_id)
  );
  const stale = all.filter((p) => !freshIds.has(p.aoe2ProfileId));

  // Tandas secuenciales: el throttle interno frena por ráfaga, acá
  // acotamos cuántos intentamos en esta corrida.
  const batch = stale.slice(0, limit);
  let refreshed = 0;
  const CHUNK = 6;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const results = await Promise.all(
      batch.slice(i, i + CHUNK).map((p) => refreshPlayerStatsCache(p.aoe2ProfileId, p.playerRegistrationId))
    );
    refreshed += results.filter(Boolean).length;
  }

  return NextResponse.json({
    ok: true,
    players: all.length,
    staleOrMissing: stale.length,
    attempted: batch.length,
    refreshed,
    remaining: Math.max(0, stale.length - batch.length),
  });
}
