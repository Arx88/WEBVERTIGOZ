import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { syncAoe2IfDue } from "@/lib/aoe2/match-sync";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sync-aoe2
 *
 * Barre todos los matches in_progress y sincroniza sus partidas con
 * AoE2 Companion (descubrimiento por nombre de sala + auto-reporte).
 * Es el respaldo del sync lazy que corre al cargar las páginas del
 * partido; pensado para un cron externo:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/sync-aoe2
 * Sin CRON_SECRET configurado, solo se permite en desarrollo.
 * El throttle interno (45s por partida) acota los requests a Companion.
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

  const admin = getSupabaseServiceRole() as any;
  const { data: matches } = await admin
    .from("match")
    .select("id")
    .eq("status", "in_progress");

  let checked = 0;
  let synced = 0;
  for (const m of matches ?? []) {
    const r = await syncAoe2IfDue(m.id);
    checked += r.checked;
    synced += r.synced;
  }

  return NextResponse.json({
    ok: true,
    matchesInProgress: (matches ?? []).length,
    gamesChecked: checked,
    gamesAutoReported: synced,
  });
}
