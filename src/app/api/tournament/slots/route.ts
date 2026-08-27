import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { getEditionForRegistration } from "@/lib/edition";

/**
 * GET /api/tournament/slots
 * Cupo público de equipos de la edición con inscripciones abiertas:
 * lugares totales (max_teams), ocupados (aprobados + pendientes) y libres.
 * No requiere auth — dato público del torneo, usado por el landing.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = getSupabaseServiceRole() as any;

    const edition = await getEditionForRegistration(service);
    if (!edition) {
      return NextResponse.json({ open: false });
    }

    // Mismo criterio que el control de cupo del wizard: aprobados + pendientes
    const { count } = await service
      .from("team_registration")
      .select("id", { count: "exact", head: true })
      .eq("tournament_edition_id", edition.id)
      .in("status", ["approved", "pending"]);

    const maxTeams = edition.max_teams ?? 32;
    const taken = Math.min(count ?? 0, maxTeams);

    return NextResponse.json({
      open: true,
      editionName: edition.name,
      maxTeams,
      taken,
      remaining: Math.max(0, maxTeams - taken),
    });
  } catch (err) {
    console.error("[tournament/slots] error:", err);
    return NextResponse.json({ open: false });
  }
}
