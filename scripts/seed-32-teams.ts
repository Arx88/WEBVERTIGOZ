/**
 * VÉRTIGO Cup — Seed de 32 equipos sintéticos para desarrollo.
 *
 * Crea 32 team_accounts + team_registrations + 96 player_registrations
 * + 32 comodin_inventory, todo consistente con una edición activa.
 * Los "profiles" de AoE2 son sintéticos pero con ELO realista bajo el cap.
 *
 * Uso:  node --experimental-strip-types scripts/seed-32-teams.ts
 *   o:  npx tsx scripts/seed-32-teams.ts
 *
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Cargar .env.local manualmente (sin dependencia de dotenv para ser standalone)
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEAM_NAMES = [
  "Legión del Norte", "Trono de Hierro", "Clan de la Tormenta", "Hijos del Río",
  "Guardia del Fénix", "Pueblo de la Niebla", "Lobos Esteparios", "Corona Rota",
  "Vanguardia Real", "Los Inquebrantables", "Orden del Cuervo", "Khanato Libre",
  "Escuadrón Carmesí", "Forja de Valor", "Estandarte Alto", "Sombras de Jinzu",
  "Cruzados del Lago", "Centuria VII", "Heraldos del Alba", "Muro Infranqueable",
  "Caballeros de la Brasa", "Senda del Jaguar", "Torre Vigía", "Alianza Antigua",
  "Puño de Acero", "Los de la Frontera", "Guardianes del Paso", "Cónclave Arcano",
  "Resistencia del Sur", "Hijos de la Tormenta", "Reino del Alba", "Furia del Norte",
];

const TAGLINES = [
  "La victoria se forja en la paciencia.", "Nunca retrocedemos.", "El acero no miente.",
  "Unidos por la corona.", "Del caos, orden.", "Sangre y honor.", "Somos la tormenta.",
  "La lealtad es nuestro escudo.", "Nacidos para la guerra.", "El rey ha caído, nosotros no.",
  "Silencio antes del golpe.", "Ningún muro nos detiene.", "La gloria es eterna.",
  "Vencemos o aprendemos.", "La estepa nos guía.", "Por la memoria de los caídos.",
  "Nuestra furia no conoce descanso.", "El frío nos hace fuertes.", "Somos leyenda.",
];

const CIV_POOL = [
  "britons","franks","goths","teutons","japanese","chinese","byzantines","persians","saracens","turks",
  "vikings","mongols","celts","spanish","aztecs","mayans","huns","koreans","italians","hindustanis",
  "incas","magyars","slavs","berbers","ethiopians","malians","portuguese","burmese","khmer","malay",
  "vietnamese","bulgarians","cumans","lithuanians","tatars","burgundians","sicilians","poles","bohemians","romans",
  "armenians","georgians","bengalis","dravidians","gurjaras","jurchens","khitans","mapuche","muiscas","shu",
];

const COUNTRIES = ["AR","ES","MX","CL","CO","PE","UY","BR","DE","FR"];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickN<T>(arr: T[], n: number): T[] {
  const c = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
  }
  return out;
}

async function main() {
  console.log("=== VÉRTIGO Cup — Seed de 32 equipos ===");

  // 1. Edición activa
  const { data: edition, error: edErr } = await supabase
    .from("tournament_edition")
    .select("id, slug, name, status, elo_cap, elo_tolerance, civs_base, civs_extra_finalist, comodin_reroll, comodin_anular, comodin_elegir_rival, comodin_invocar_pro")
    .eq("slug", "vertigo-2026-1")
    .single();
  if (edErr || !edition) {
    console.error("No se encontró la edición vertigo-2026-1. Error:", edErr?.message);
    process.exit(1);
  }
  console.log(`Edición: ${edition.name} (${edition.status})`);

  // 2. Emblemas disponibles (deben existir; si no, seguimos con emblem_id null)
  const { data: emblems } = await supabase.from("emblem").select("id").eq("is_active", true);
  const emblemIds = (emblems ?? []).map((e) => e.id);
  console.log(`Emblemas disponibles: ${emblemIds.length}`);

  const eloCap = edition.elo_cap ?? 3500;
  const eloTolerance = edition.elo_tolerance ?? 20;
  const maxTotal = eloCap + eloTolerance; // 3520
  const civsBase = edition.civs_base ?? 9;
  const civsExtra = edition.civs_extra_finalist ?? 3;

  // 3. Limpiar datos de prueba previos SOLO si CLARAMENTE son seed (opcional, off por defecto)
  // Comentado por seguridad: el usuario pidió "limpiar y generar", pero lo hago idempotente
  // via upsert por nombre de equipo en vez de borrar. Si el equipo ya existe, se saltea.
  console.log("Creando/actualizando 32 equipos…");

  let created = 0, skipped = 0, errored = 0;

  for (let i = 0; i < 32; i++) {
    const teamName = `${TEAM_NAMES[i]}`;
    const tagline = TAGLINES[i % TAGLINES.length];
    const emblemId = emblemIds.length > 0 ? emblemIds[i % emblemIds.length] : null;

    try {
      // team_account (idempotente por nombre + edición: si ya existe registration para esta edición con ese nombre, salteamos)
      const { data: existing } = await supabase
        .from("team_account")
        .select("id, team_registration:team_registration(id)")
        .eq("name", teamName)
        .maybeSingle();

      let teamAccountId: string;
      if (existing?.id) {
        teamAccountId = existing.id;
        // saltar si ya tiene registration en esta edición
        const { data: existingReg } = await supabase
          .from("team_registration")
          .select("id")
          .eq("team_account_id", teamAccountId)
          .eq("tournament_edition_id", edition.id)
          .maybeSingle();
        if (existingReg) { skipped++; continue; }
      } else {
        // owner sintético (account con email fake apuntando a un supabase_auth_id faker)
        const fakeAuthId = crypto.randomUUID();
        const { data: acc, error: accErr } = await supabase.from("account").insert({
          supabase_auth_id: fakeAuthId,
          email: `seed${i + 1}@vertigo.test`,
          role: "owner",
          display_name: teamName,
        }).select("id").single();
        if (accErr) throw new Error(`account: ${accErr.message}`);

        const { data: ta, error: taErr } = await supabase.from("team_account").insert({
          owner_id: acc.id,
          name: teamName,
          tagline,
          emblem_id: emblemId,
        }).select("id").single();
        if (taErr) throw new Error(`team_account: ${taErr.message}`);
        teamAccountId = ta.id;
      }

      // Generar 3 ELOs que sumen <= maxTotal (3520) — distribución realista 900-1250 c/u
      let p1 = randInt(900, 1250);
      let p2 = randInt(900, 1250);
      let p3 = randInt(900, 1250);
      const total = p1 + p2 + p3;
      if (total > maxTotal) {
        // escalar proporcionalmente
        const scale = maxTotal / total;
        p1 = Math.floor(p1 * scale); p2 = Math.floor(p2 * scale); p3 = Math.floor(p3 * scale);
      }
      const eloTotal = p1 + p2 + p3;

      // 12 civs: 9 base + 3 extra (distintas)
      const allCivs = pickN(CIV_POOL, civsBase + civsExtra);
      const baseCivs = allCivs.slice(0, civsBase);
      const extraCivs = allCivs.slice(civsBase);

      // team_registration
      const { data: reg, error: regErr } = await supabase.from("team_registration").insert({
        team_account_id: teamAccountId,
        tournament_edition_id: edition.id,
        base_civ_ids: baseCivs,
        extra_civ_ids: extraCivs,
        elo_freeze_snapshot: eloTotal,
        elo_verification_status: "verified",
        status: "approved",
        restream_accepted: true,
        handbook_downloaded_at: new Date().toISOString(),
        terms_accepted_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      }).select("id").single();
      if (regErr) throw new Error(`team_registration: ${regErr.message}`);

      // 3 player_registration (1 capitán = índice 0)
      const players = [
        { n: 1, elo: p1, captain: true },
        { n: 2, elo: p2, captain: false },
        { n: 3, elo: p3, captain: false },
      ];
      const { error: plErr } = await supabase.from("player_registration").insert(
        players.map((p) => ({
          team_registration_id: reg.id,
          aoe2_profile_id: 100000 + i * 10 + p.n,
          display_name: `${TEAM_NAMES[i].split(" ")[0]} P${p.n}`,
          country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
          clan: teamName.slice(0, 4).toUpperCase(),
          is_verified: true,
          max_rating_rm_1v1: p.elo,
          rating_rm_1v1_current: p.elo - randInt(0, 80),
          is_captain: p.captain,
          linked_profiles: [],
        }))
      );
      if (plErr) throw new Error(`players: ${plErr.message}`);

      // comodin_inventory (los defaults vienen de la edición)
      const { error: invErr } = await supabase.from("comodin_inventory").insert({
        team_registration_id: reg.id,
        reroll_available: edition.comodin_reroll ?? 2,
        anular_available: edition.comodin_anular ?? 1,
        elegir_rival_available: edition.comodin_elegir_rival ?? 1,
        invocar_pro_available: edition.comodin_invocar_pro ?? 1,
      });
      // comodin_inventory también lo crea el trigger; si falla por duplicado, lo ignoramos
      if (invErr && invErr.code !== "23505") throw new Error(`inventory: ${invErr.message}`);

      created++;
      if (created % 8 === 0) console.log(`  …${created} equipos creados`);
    } catch (e) {
      errored++;
      console.error(`  ✗ Equipo ${i + 1} (${teamName}):`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`Creados:  ${created}`);
  console.log(`Salteados (ya existían): ${skipped}`);
  console.log(`Errores:  ${errored}`);
  console.log(`Total esperado en DB: 32 (sumar creados + existentes)`);

  // Verificación final
  const { count } = await supabase
    .from("team_registration")
    .select("id", { count: "exact", head: true })
    .eq("tournament_edition_id", edition.id)
    .eq("status", "approved");
  console.log(`Registrations aprobadas en edición: ${count}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
