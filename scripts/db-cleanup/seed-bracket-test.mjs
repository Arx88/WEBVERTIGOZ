/**
 * VÉRTIGO Cup — Seed de bracket de prueba (32 equipos).
 *
 * Prepara la Ronda 1 para probar el flujo completo de una llave:
 *   - Crea 30 equipos sintéticos (account + team_account + registration
 *     aprobada + 3 jugadores + inventario de comodines).
 *   - Aprueba las registraciones reales de PSX (cristiandmitruk@gmail.com)
 *     y PAPÁ de cristian (damianemponce@gmail.com).
 *   - Llave 1 (slot 0) = PSX vs PAPÁ de cristian; slots 1..15 = truchos.
 *   - NO toca fechas (scheduled_at queda null para probar "poner fecha"),
 *     ni el match de prueba 142cbb11 (slot 100).
 *
 * Uso: node scripts/db-cleanup/seed-bracket-test.mjs
 * Idempotente: si ya existe un team_account con el mismo nombre y
 * registración en la edición, lo reutiliza.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EDITION_SLUG = "vertigo-2026-1";
const ROUND1_ID = "0209a5d8-c662-4b49-a387-067e38e2a434";
const ADMIN_ACCOUNT_ID = "a6600514-2644-4247-9fc1-297d4531dd99"; // somosarcadian (super_admin)
const REG_CRISTIAN = "10a23d89-8c82-41fe-a28b-11a502f863e7"; // PSX
const REG_DAMIAN = "5b791f83-59e0-486d-b37b-ea8a55b6bb43"; // PAPÁ de cristian

const TEAM_NAMES = [
  "Legión del Norte", "Trono de Hierro", "Clan de la Tormenta", "Hijos del Río",
  "Guardia del Fénix", "Pueblo de la Niebla", "Lobos Esteparios", "Corona Rota",
  "Vanguardia Real", "Los Inquebrantables", "Orden del Cuervo", "Khanato Libre",
  "Escuadrón Carmesí", "Forja de Valor", "Estandarte Alto", "Sombras de Jinzu",
  "Cruzados del Lago", "Centuria VII", "Heraldos del Alba", "Muro Infranqueable",
  "Caballeros de la Brasa", "Senda del Jaguar", "Torre Vigía", "Alianza Antigua",
  "Puño de Acero", "Los de la Frontera", "Guardianes del Paso", "Cónclave Arcano",
  "Resistencia del Sur", "Furia del Alba",
];

const TAGLINES = [
  "La victoria se forja en la paciencia.", "Nunca retrocedemos.", "El acero no miente.",
  "Unidos por la corona.", "Del caos, orden.", "Sangre y honor.", "Somos la tormenta.",
  "La lealtad es nuestro escudo.", "Nacidos para la guerra.", "El rey ha caído, nosotros no.",
  "Silencio antes del golpe.", "Ningún muro nos detiene.", "La gloria es eterna.",
  "Vencemos o aprendemos.", "La estepa nos guía.",
];

const CIV_POOL = [
  "britons", "franks", "goths", "teutons", "japanese", "chinese", "byzantines", "persians", "saracens", "turks",
  "vikings", "mongols", "celts", "spanish", "aztecs", "mayans", "huns", "koreans", "italians", "hindustanis",
  "incas", "magyars", "slavs", "berbers", "ethiopians", "malians", "portuguese", "burmese", "khmer", "malay",
  "vietnamese", "bulgarians", "cumans", "lithuanians", "tatars", "burgundians", "sicilians", "poles", "bohemians", "romans",
  "armenians", "georgians", "bengalis", "dravidians", "gurjaras", "jurchens", "khitans", "mapuche", "muiscas", "shu",
];

const COUNTRIES = ["AR", "ES", "MX", "CL", "CO", "PE", "UY", "BR"];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
function pickN(arr, n) {
  const c = [...arr];
  const out = [];
  for (let i = 0; i < n; i++) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
  return out;
}

async function approveRegistration(regId, label) {
  const { data: reg, error } = await supabase
    .from("team_registration")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_id: ADMIN_ACCOUNT_ID,
      elo_verification_status: "verified",
      restream_accepted: true,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", regId)
    .select("id, status")
    .single();
  if (error) throw new Error(`aprobar ${label}: ${error.message}`);
  console.log(`✓ registración aprobada: ${label} (${reg.status})`);
}

async function ensureFakeTeam(i, edition, emblemIds) {
  const teamName = TEAM_NAMES[i];
  const maxTotal = (edition.elo_cap ?? 3500) + (edition.elo_tolerance ?? 20);

  // ¿Ya existe el equipo con registración en esta edición?
  const { data: existing } = await supabase
    .from("team_account")
    .select("id")
    .eq("name", teamName)
    .maybeSingle();

  let teamAccountId;
  if (existing?.id) {
    teamAccountId = existing.id;
    const { data: existingReg } = await supabase
      .from("team_registration")
      .select("id, status")
      .eq("team_account_id", teamAccountId)
      .eq("tournament_edition_id", edition.id)
      .maybeSingle();
    if (existingReg) {
      if (existingReg.status !== "approved") await approveRegistration(existingReg.id, teamName);
      return existingReg.id;
    }
  } else {
    const { data: acc, error: accErr } = await supabase.from("account").insert({
      supabase_auth_id: crypto.randomUUID(),
      email: `bracket-seed${i + 1}@vertigo.test`,
      role: "owner",
      display_name: teamName,
    }).select("id").single();
    if (accErr) throw new Error(`account ${teamName}: ${accErr.message}`);

    const { data: ta, error: taErr } = await supabase.from("team_account").insert({
      owner_id: acc.id,
      name: teamName,
      tagline: TAGLINES[i % TAGLINES.length],
      emblem_id: emblemIds.length ? emblemIds[i % emblemIds.length] : null,
    }).select("id").single();
    if (taErr) throw new Error(`team_account ${teamName}: ${taErr.message}`);
    teamAccountId = ta.id;
  }

  // 3 ELOs bajo el cap
  let p1 = randInt(900, 1250), p2 = randInt(900, 1250), p3 = randInt(900, 1250);
  const total = p1 + p2 + p3;
  if (total > maxTotal) {
    const s = maxTotal / total;
    p1 = Math.floor(p1 * s); p2 = Math.floor(p2 * s); p3 = Math.floor(p3 * s);
  }

  const civs = pickN(CIV_POOL, (edition.civs_base ?? 9) + (edition.civs_extra_finalist ?? 3));
  const now = new Date().toISOString();
  const { data: reg, error: regErr } = await supabase.from("team_registration").insert({
    team_account_id: teamAccountId,
    tournament_edition_id: edition.id,
    base_civ_ids: civs.slice(0, edition.civs_base ?? 9),
    extra_civ_ids: civs.slice(edition.civs_base ?? 9),
    elo_freeze_snapshot: p1 + p2 + p3,
    elo_verification_status: "verified",
    status: "approved",
    restream_accepted: true,
    handbook_downloaded_at: now,
    terms_accepted_at: now,
    submitted_at: now,
    approved_at: now,
    approved_by_id: ADMIN_ACCOUNT_ID,
  }).select("id").single();
  if (regErr) throw new Error(`registration ${teamName}: ${regErr.message}`);

  const players = [
    { n: 1, elo: p1, captain: true },
    { n: 2, elo: p2, captain: false },
    { n: 3, elo: p3, captain: false },
  ];
  const { error: plErr } = await supabase.from("player_registration").insert(
    players.map((p) => ({
      team_registration_id: reg.id,
      aoe2_profile_id: 200000 + i * 10 + p.n,
      display_name: `${teamName.split(" ")[0]} P${p.n}`,
      country: COUNTRIES[randInt(0, COUNTRIES.length - 1)],
      clan: teamName.slice(0, 4).toUpperCase(),
      is_verified: true,
      max_rating_rm_1v1: p.elo,
      rating_rm_1v1_current: p.elo - randInt(0, 80),
      is_captain: p.captain,
      linked_profiles: [],
    }))
  );
  if (plErr) throw new Error(`players ${teamName}: ${plErr.message}`);

  const { error: invErr } = await supabase.from("comodin_inventory").insert({
    team_registration_id: reg.id,
    reroll_available: edition.comodin_reroll ?? 2,
    anular_available: edition.comodin_anular ?? 1,
    elegir_rival_available: edition.comodin_elegir_rival ?? 1,
    invocar_pro_available: edition.comodin_invocar_pro ?? 1,
  });
  if (invErr && invErr.code !== "23505") throw new Error(`inventory ${teamName}: ${invErr.message}`);

  return reg.id;
}

async function main() {
  console.log("=== VÉRTIGO Cup — Seed bracket de prueba ===");

  const { data: edition, error: edErr } = await supabase
    .from("tournament_edition")
    .select("*")
    .eq("slug", EDITION_SLUG)
    .single();
  if (edErr || !edition) throw new Error(`edición ${EDITION_SLUG}: ${edErr?.message}`);
  console.log(`Edición: ${edition.name}`);

  const { data: emblems } = await supabase.from("emblem").select("id").eq("is_active", true);
  const emblemIds = (emblems ?? []).map((e) => e.id);

  // 1) Aprobar las dos registraciones reales
  await approveRegistration(REG_CRISTIAN, "PSX (cristiandmitruk)");
  await approveRegistration(REG_DAMIAN, "PAPÁ de cristian (damianemponce)");

  // 2) Crear/reutilizar los 30 equipos truchos
  const fakeRegIds = [];
  for (let i = 0; i < 30; i++) {
    const regId = await ensureFakeTeam(i, edition, emblemIds);
    fakeRegIds.push(regId);
    if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/30 equipos truchos`);
  }

  // 3) Asignar la Ronda 1: slot 0 = Cristian vs Damián; 1..15 = truchos
  const { data: slots, error: slotsErr } = await supabase
    .from("match")
    .select("id, slot_index, team_a_id, team_b_id")
    .eq("round_id", ROUND1_ID)
    .order("slot_index");
  if (slotsErr) throw new Error(`slots: ${slotsErr.message}`);

  const pairs = [
    [REG_CRISTIAN, REG_DAMIAN],
    ...Array.from({ length: 15 }, (_, k) => [fakeRegIds[k * 2], fakeRegIds[k * 2 + 1]]),
  ];

  let assigned = 0;
  for (const slot of slots) {
    if (slot.slot_index >= 16) continue; // el slot 100 (match de prueba) no se toca
    const [a, b] = pairs[slot.slot_index];
    if (!a || !b) throw new Error(`sin pareja para slot ${slot.slot_index}`);
    const { error } = await supabase
      .from("match")
      .update({ team_a_id: a, team_b_id: b })
      .eq("id", slot.id);
    if (error) throw new Error(`slot ${slot.slot_index}: ${error.message}`);
    assigned++;
  }
  console.log(`✓ ${assigned} llaves de Ronda 1 con equipos`);

  // 4) Verificación final
  const { data: check } = await supabase
    .from("match")
    .select("slot_index, team_a:team_a_id(id, team_account:team_account(name)), team_b:team_b_id(id, team_account:team_account(name))")
    .eq("round_id", ROUND1_ID)
    .order("slot_index");
  console.log("\n=== RONDA 1 ===");
  for (const m of check ?? []) {
    const na = m.team_a?.team_account?.name ?? "—";
    const nb = m.team_b?.team_account?.name ?? "—";
    console.log(`  llave ${String(m.slot_index).padStart(2, "0")}: ${na}  VS  ${nb}`);
  }
  const { count } = await supabase
    .from("team_registration")
    .select("id", { count: "exact", head: true })
    .eq("tournament_edition_id", edition.id)
    .eq("status", "approved");
  console.log(`\nRegistraciones aprobadas en la edición: ${count}`);
}

main().catch((e) => { console.error("Fatal:", e.message ?? e); process.exit(1); });
