import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { getMaxRatingFromProfile } from "@/lib/aoe2";
import type { Aoe2Profile } from "@/types/domain";

export const dynamic = "force-dynamic";

const API_URL = process.env.AOE2_COMPANION_API_URL ?? "https://data.aoe2companion.com";
const USER_AGENT = process.env.AOE2_COMPANION_USER_AGENT ?? "VERTIGO-Cup/1.0";

// Throttle propio: Companion rechaza ráfagas (~16 req / 10s por IP).
const MAX_REQUESTS = 14;
const WINDOW_MS = 10_000;
let reqCount = 0;
let windowStart = Date.now();

async function throttleCompanion() {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    reqCount = 0;
    windowStart = now;
  }
  if (reqCount >= MAX_REQUESTS) {
    await new Promise((r) => setTimeout(r, WINDOW_MS - (now - windowStart) + 150));
    reqCount = 0;
    windowStart = Date.now();
  }
  reqCount++;
}

/**
 * GET /api/cron/refresh-ratings?limit=25&offset=0
 *
 * Refresca max_rating_rm_1v1 y rating_rm_1v1_current de los jugadores de
 * equipos aprobados directo desde Companion (historial de ratings ordenado
 * por fecha: actual = partida más reciente; max = máx(historial, ladder)).
 *
 * El rating se guarda al inscribirse y se desactualiza si el jugador sigue
 * jugando; este cron lo mantiene fresco. Procesa en tandas (limit/offset)
 * para respetar el rate limit y los timeouts del serverless: corridas
 * sucesivas con offset creciente cubren a todos.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://<host>/api/cron/refresh-ratings?limit=25&offset=0"
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
  const offset = Math.max(Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0, 0);
  const admin = getSupabaseServiceRole() as any;

  // Jugadores de inscripciones aprobadas
  const { data: regs } = await admin
    .from("team_registration")
    .select("id")
    .eq("status", "approved");
  const regIds = (regs ?? []).map((r: any) => r.id);
  if (regIds.length === 0) return NextResponse.json({ processed: 0, changed: 0 });

  const all: any[] = [];
  for (let i = 0; i < regIds.length; i += 50) {
    const { data: ps } = await admin
      .from("player_registration")
      .select("id, aoe2_profile_id, max_rating_rm_1v1, rating_rm_1v1_current")
      .in("team_registration_id", regIds.slice(i, i + 50));
    all.push(...(ps ?? []));
  }

  const batch = all.slice(offset, offset + limit);
  let changed = 0;
  let failed = 0;

  for (const p of batch) {
    let fresh: { maxRating: number | null; currentRating: number | null } | null = null;
    try {
      await throttleCompanion();
      const res = await fetch(`${API_URL}/api/profiles/${p.aoe2_profile_id}?extend=stats,ratings`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const profile = (await res.json()) as Aoe2Profile;
        fresh = getMaxRatingFromProfile(profile);
      }
    } catch {
      // error transitorio: se cubre en la próxima corrida
    }
    if (!fresh || (fresh.maxRating == null && fresh.currentRating == null)) {
      failed++;
      continue;
    }
    const patch: Record<string, number> = {};
    if (fresh.maxRating != null && fresh.maxRating !== p.max_rating_rm_1v1) {
      patch.max_rating_rm_1v1 = fresh.maxRating;
    }
    if (fresh.currentRating != null && fresh.currentRating !== p.rating_rm_1v1_current) {
      patch.rating_rm_1v1_current = fresh.currentRating;
    }
    if (Object.keys(patch).length === 0) continue;
    const { error } = await admin
      .from("player_registration")
      .update(patch)
      .eq("id", p.id);
    if (error) failed++;
    else changed++;
  }

  return NextResponse.json({
    processed: batch.length,
    changed,
    failed,
    total: all.length,
    nextOffset: offset + limit < all.length ? offset + limit : 0,
  });
}
