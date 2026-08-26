import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getEditionForRegistration, signHandbookUrl } from "@/lib/edition";

/**
 * GET /api/tournament/config
 * Devuelve la configuración de la edición con inscripciones abiertas.
 * Usado por el wizard para obtener ELO cap, civs count, handbook, etc.
 *
 * No requiere auth — es info pública del torneo. El handbook se sirve como
 * URL firmada temporal (el bucket es privado).
 */
export async function GET() {
  try {
    const supabase = await getSupabaseServer();

    const edition = await getEditionForRegistration(supabase);

    if (!edition) {
      // Fallback a defaults si no hay edición en DB (ej. en dev sin seed)
      return NextResponse.json({
        eloCap: 3500,
        eloTolerance: 20,
        eloMax: 3520,
        civsBase: 9,
        civsExtra: 3,
        handbookUrl: null,
        found: false,
      });
    }

    const eloCap = edition.elo_cap ?? 3500;
    const eloTolerance = edition.elo_tolerance ?? 20;
    const handbookUrl = await signHandbookUrl(edition);

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
      handbookUrl,
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
        handbookUrl: null,
        found: false,
      },
      { status: 200 }
    );
  }
}
