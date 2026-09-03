import fs from "node:fs";
import path from "node:path";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Dices, Ban, Info } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { getEditionForAdmin } from "@/lib/edition";
import RuletaEditor from "./ruleta-editor";

export const dynamic = "force-dynamic";

/**
 * /admin/ruletas — Configuración COMPLETA de las ruletas del torneo.
 *
 * Editor del preset (preset_version.config): qué modos, antimetas (con su
 * pool de mapas propio), formatos, llaves y mapas puede sortear la ruleta,
 * el arte y textos de cada card, el peso de cada opción, y la presentación
 * (música/sonidos/fondo). Un solo guardado crea una versión nueva del preset
 * si la actual ya fue usada por sorteos.
 */

const KIND_LISTS: { kind: RuletaListKind; label: string; desc: string }[] = [
  { kind: "MODO", label: "Modos", desc: "Qué modos puede salir en la ruleta grande." },
  { kind: "ANTIMETA", label: "Antimetas", desc: "Restricciones caóticas que se sortean cuando sale el modo ANTIMETA. Cada una puede tener su propio pool de mapas." },
  { kind: "FORMATO", label: "Formatos", desc: "1v1, 2v2, 3v3 o FUSIÓN — cuántos jugadores juegan y cuántas civs sortea el memotest por equipo." },
  { kind: "LLAVE", label: "Llaves", desc: "BO1 o BO3 — cuántos partidos decide la llave." },
  { kind: "MAPA", label: "Mapas", desc: "Pool de mapas global del sorteo." },
];

type RuletaListKind = "MODO" | "ANTIMETA" | "FORMATO" | "LLAVE" | "MAPA";

const KIND_TO_CONFIG_KEY = {
  MODO: "gameModes",
  ANTIMETA: "antimetaModes",
  FORMATO: "playerModes",
  LLAVE: "llaveModes",
  MAPA: "mapModes",
} as const;

/** Lee el arte disponible en public/modes/ (rutas servibles, "/modes/..."). */
function readAvailableArt(): string[] {
  const root = path.join(process.cwd(), "public", "modes");
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      } else if (/\.(webp|png|jpe?g|avif|gif)$/i.test(e.name)) {
        out.push(`/modes/${prefix}${e.name}`);
      }
    }
  };
  walk(root, "");
  return out.sort();
}

export default async function AdminRuletasPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const params = await searchParams;
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const edition = await getEditionForAdmin(supabase, params.edition);

  const service = getSupabaseServiceRole() as any;
  let preset: any = null;
  if (edition?.preset_version_id) {
    const { data } = await service
      .from("preset_version")
      .select("id, version, is_frozen, frozen_at, config")
      .eq("id", edition.preset_version_id)
      .single();
    preset = data;
  }

  const config = (preset?.config ?? {}) as Record<string, any>;
  const lists = KIND_LISTS.map((l) => ({
    kind: l.kind,
    label: l.label,
    desc: l.desc,
    options: (config[KIND_TO_CONFIG_KEY[l.kind]] ?? []) as any[],
  }));
  const totalOptions = lists.reduce((acc, l) => acc + l.options.length, 0);
  const activeOptions = lists.reduce(
    (acc, l) => acc + l.options.filter((o: any) => (o.weight ?? 1) > 0).length,
    0
  );

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="CONTENIDO"
        title="Ruletas"
        desc="Configurá todo lo que puede salir en la ruleta y el memotest de la stream: modos, antimetas con sus pools de mapas, formatos, llaves, mapas, el arte de cada card y la presentación. Peso 0 (o switch apagado) excluye la opción del sorteo."
        stats={[
          { value: edition?.name ?? "—", label: "Edición" },
          { value: preset ? `v${preset.version}` : "—", label: "Preset" },
          { value: activeOptions ? `${activeOptions}/${totalOptions}` : "—", label: "Activas" },
          {
            value: preset?.is_frozen ? "Congelado" : "Editable",
            label: "Estado",
            color: preset?.is_frozen ? "var(--vertigo-danger)" : "var(--vertigo-success)",
          },
        ]}
      />

      {!edition ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <Dices className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
            <div className="vertigo-empty-title">Sin edición activa</div>
            <p className="vertigo-empty-desc">Creá una edición del torneo primero, desde la sección Torneo.</p>
          </div>
        </div>
      ) : !preset ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <Info className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
            <div className="vertigo-empty-title">La edición todavía no tiene preset de ruleta</div>
            <p className="vertigo-empty-desc">
              El primer sorteo de esta edición toma automáticamente la última configuración guardada.
              Si ya hay sorteos girados y seguís viendo esto, asignale un preset a la edición desde la base de datos.
            </p>
          </div>
        </div>
      ) : (
        <RuletaEditor
          editionId={edition.id}
          presetVersion={preset.version}
          disabled={!!preset.is_frozen}
          lists={lists}
          presentation={{
            music: config.music ?? { enabled: false, volume: 0.2 },
            sounds: config.sounds ?? { enabled: true, volume: 1 },
            background: config.background === "vortex" ? "vortex" : "fondo",
            firstRound: config.firstRound ?? false,
            epicCards: config.epicCards ?? false,
          }}
          availableArt={readAvailableArt()}
        />
      )}
    </div>
  );
}
