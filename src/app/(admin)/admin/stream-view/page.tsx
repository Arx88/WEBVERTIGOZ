import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Tv } from "lucide-react";
import { getEditionForAdmin } from "@/lib/edition";
import StreamView from "./stream-view";

export const dynamic = "force-dynamic";

/**
 * /admin/stream-view — Consola de producción del streamer.
 *
 * Previsualiza EXACTAMENTE cómo se ven las 5 escenas del stream (sorteo
 * completo de la ruleta, re-girar por comodín, memotest de civs, cartas
 * épicas de comodines y pantalla del stream) usando el preset REAL de la
 * edición y los equipos inscriptos — sin escribir NADA en la base de
 * datos. Permite forzar el resultado de cada fase para ensayar el guion.
 *
 * Es 100% lectura: el sorteo simulado usa src/lib/ruleta/simulate.ts
 * (client-side) y nunca toca draw_audit_log ni preset_version.
 */
export default async function AdminStreamViewPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const edition = await getEditionForAdmin(supabase, undefined);

  const service = getSupabaseServiceRole() as any;

  // Preset REAL de la edición (mismo loader que /admin/ruletas).
  // Es la config de la ruleta: las opciones, arte, pesos y presentación
  // que verán el streamer y los viewers en producción.
  let presetConfig: any = null;
  let presetMeta: { version: number; isFrozen: boolean } | null = null;
  if (edition?.preset_version_id) {
    const { data } = await service
      .from("preset_version")
      .select("version, is_frozen, config")
      .eq("id", edition.preset_version_id)
      .single();
    presetConfig = data?.config ?? null;
    presetMeta = data ? { version: data.version, isFrozen: !!data.is_frozen } : null;
  }

  // Equipos reales inscriptos (aprobados primero): sus nombres, escudos y
  // colores alimentan la pantalla del stream y las cartas épicas.
  const { data: regs } = (await service
    .from("team_registration")
    .select(`
      id, seed, status,
      team_account:team_account_id (id, name, tagline, emblem:emblem_id (image_url))
    `)
    .eq("tournament_edition_id", edition?.id ?? "")
    .in("status", ["approved", "pending"])
    .order("status")
    .limit(40)) as { data: any };

  const teams = (regs ?? []).map((r: any) => ({
    id: r.id,
    name: r.team_account?.name ?? "Equipo",
    emblemUrl: r.team_account?.emblem?.image_url ?? null,
    seed: r.seed ?? null,
  }));

  return (
    <div className="vertigo-fade-in sv-page">
      {!presetConfig ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <Tv className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
            <div className="vertigo-empty-title">Sin preset de ruleta</div>
            <p className="vertigo-empty-desc">
              Esta edición todavía no tiene un preset de ruleta (se crea con el primer sorteo,
              o lo configurás en Ruletas). El Stream View necesita el preset para previsualizar
              las escenas con las opciones reales.
            </p>
          </div>
        </div>
      ) : (
        <StreamView
          preset={presetConfig}
          presetMeta={presetMeta}
          teams={teams}
          editionName={edition?.name ?? ""}
        />
      )}
    </div>
  );
}
