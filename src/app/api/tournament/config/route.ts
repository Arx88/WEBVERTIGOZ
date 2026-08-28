import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { getEditionForRegistration, signHandbookUrl } from "@/lib/edition";
import { expireUnpaidRegistrations } from "@/lib/cupo";

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
    // Sweep de cupo (0014): expira inscripciones impagas vencidas antes de
    // calcular el cupo del wizard. En Vercel Hobby el cron corre 1x/día; con
    // este sweep la liberación es inmediata apenas alguien abre el wizard.
    // No-op barato (índice parcial) si no hay nada vencido.
    try {
      await expireUnpaidRegistrations();
    } catch (e) {
      console.error("[config] sweep de cupo falló (no fatal):", e);
    }

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

    // Cupo público (mismo criterio que el freno del wizard y /api/tournament/slots):
    // aprobados + pendientes. Con service role porque el cliente no puede contar
    // por RLS. Si falla, slots=null y el wizard no frena por cupo (fail-open).
    let slots: { maxTeams: number; taken: number; remaining: number } | null = null;
    try {
      const service = getSupabaseServiceRole() as any;
      const { count } = await service
        .from("team_registration")
        .select("id", { count: "exact", head: true })
        .eq("tournament_edition_id", edition.id)
        .in("status", ["approved", "pending"]);
      const maxTeams = edition.max_teams ?? 32;
      const taken = Math.min(count ?? 0, maxTeams);
      slots = { maxTeams, taken, remaining: Math.max(0, maxTeams - taken) };
    } catch {
      slots = null;
    }

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
      slots,
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
