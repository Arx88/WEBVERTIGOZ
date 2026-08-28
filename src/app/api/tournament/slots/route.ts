import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { getEditionForRegistration } from "@/lib/edition";
import { expireUnpaidRegistrations } from "@/lib/cupo";

/**
 * GET /api/tournament/slots
 * Cupo público de equipos de la edición con inscripciones abiertas:
 * lugares totales (max_teams), ocupados (aprobados + pendientes) y libres.
 * No requiere auth — dato público del torneo, usado por el landing.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Sweep de cupo (0014): expira inscripciones impagas vencidas antes de
    // contar. En Vercel Hobby el cron corre 1x/día; con este sweep la
    // liberación de la plaza es inmediata apenas alguien abre el landing o
    // el wizard. Es un no-op barato (índice parcial) si no hay nada vencido.
    try {
      await expireUnpaidRegistrations();
    } catch (e) {
      console.error("[slots] sweep de cupo falló (no fatal):", e);
    }

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
