import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/tournament/config
 * Devuelve la configuración de la edición activa del torneo.
 * Usado por el wizard para obtener ELO cap, civs count, etc. dinámicamente.
 *
 * No requiere auth — es info pública del torneo.
 */
export async function GET() {
  try {
    const supabase = await getSupabaseServer();

    const { data: edition, error } = (await supabase
      .from("tournament_edition")
      .select(
        "id, slug, name, elo_cap, elo_tolerance, civs_base, civs_extra_finalist, status"
      )
      .eq("slug", "vertigo-2026-1")
      .single()) as { data: any; error: any };

    if (error || !edition) {
      // Fallback a defaults si no hay edición en DB (ej. en dev sin seed)
      return NextResponse.json({
        eloCap: 3500,
        eloTolerance: 20,
        eloMax: 3520,
        civsBase: 9,
        civsExtra: 3,
        found: false,
      });
    }

    const eloCap = edition.elo_cap ?? 3500;
    const eloTolerance = edition.elo_tolerance ?? 20;

    return NextResponse.json({
      editionId: edition.id,
      slug: edition.slug,
      name: edition.name,
      status: edition.status,
      eloCap,
      eloTolerance,
      eloMax: eloCap + eloTolerance,
      civsBase: edition.civs_base ?? 9,
      civsExtra: edition.civs_extra_finalist ?? 3,
      found: true,
    });
  } catch (err) {
    console.error("[tournament/config] error:", err);
    return NextResponse.json(
      {
        eloCap: 3500,
        eloTolerance: 20,
        eloMax: 3520,
        civsBase: 9,
        civsExtra: 3,
        found: false,
      },
      { status: 200 }
    );
  }
}
