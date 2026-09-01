/**
 * Limpia la base de datos para dejar eleman3007@gmail.com y damianemponce@gmail.com
 * como rivales en la primera llave (match d8d2edbf), ambos sin nada sorteado.
 *
 * Pasos:
 *  1. Crea cuenta + team_account + registration para eleman3007@gmail.com (si no existe)
 *  2. Reemplaza PSX (cristiandmitruk) por eleman3007 en la primera llave (match d8d2edbf)
 *  3. Borra todos los draws y games de la primera llave
 *  4. Resetea el match a estado limpio (sin sorteado)
 *  5. Limpia el slot del padre (Octavos) que recibió al ganador
 *
 * Uso: node scripts/db-cleanup/reset-first-key-clean.mjs
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

const MATCH_ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";
const ADMIN_ACCOUNT_ID = "a6600514-2644-4247-9fc1-297d4531dd99"; // somosarcadian (super_admin)
const ELEMAN_EMAIL = "eleman3007@gmail.com";
const EDITION_SLUG = "vertigo-2026-1";

async function main() {
  console.log("=== Limpieza de la primera llave ===");

  // ─── 1. Verificar/crear eleman3007 ───────────────────────────
  const { data: elemanAccount } = await supabase
    .from("account")
    .select("id, email")
    .eq("email", ELEMAN_EMAIL)
    .maybeSingle();

  let elemanAccountId;
  if (elemanAccount?.id) {
    elemanAccountId = elemanAccount.id;
    console.log(`✓ cuenta eleman ya existe: ${elemanAccountId}`);
  } else {
    const { data: newAcc, error: accErr } = await supabase
      .from("account")
      .insert({
        supabase_auth_id: crypto.randomUUID(),
        email: ELEMAN_EMAIL,
        role: "owner",
        display_name: "eleman3007",
      })
      .select("id")
      .single();
    if (accErr) throw new Error(`crear cuenta eleman: ${accErr.message}`);
    elemanAccountId = newAcc.id;
    console.log(`✓ cuenta eleman creada: ${elemanAccountId}`);
  }

  // ─── 2. Verificar/crear team_account para eleman ──────────────
  const { data: elemanTeam } = await supabase
    .from("team_account")
    .select("id, name")
    .eq("owner_id", elemanAccountId)
    .maybeSingle();

  let elemanTeamId;
  if (elemanTeam?.id) {
    elemanTeamId = elemanTeam.id;
    console.log(`✓ team eleman ya existe: ${elemanTeam.name} (${elemanTeamId})`);
  } else {
    const { data: emblems } = await supabase
      .from("emblem")
      .select("id")
      .eq("is_active", true)
      .limit(1);
    const emblemId = emblems?.[0]?.id ?? null;

    const { data: newTeam, error: teamErr } = await supabase
      .from("team_account")
      .insert({
        owner_id: elemanAccountId,
        name: "eleman3007",
        tagline: "",
        emblem_id: emblemId,
      })
      .select("id")
      .single();
    if (teamErr) throw new Error(`crear team eleman: ${teamErr.message}`);
    elemanTeamId = newTeam.id;
    console.log(`✓ team eleman creado: ${elemanTeamId}`);
  }

  // ─── 3. Verificar/crear registration para eleman ──────────────
  const { data: edition } = await supabase
    .from("tournament_edition")
    .select("id, civs_base, civs_extra_finalist, elo_cap, elo_tolerance, comodin_reroll, comodin_anular, comodin_elegir_rival, comodin_invocar_pro")
    .eq("slug", EDITION_SLUG)
    .single();
  if (!edition) throw new Error(`edición ${EDITION_SLUG} no encontrada`);

  const { data: elemanReg } = await supabase
    .from("team_registration")
    .select("id, status")
    .eq("team_account_id", elemanTeamId)
    .eq("tournament_edition_id", edition.id)
    .maybeSingle();

  let elemanRegId;
  if (elemanReg?.id) {
    elemanRegId = elemanReg.id;
    if (elemanReg.status !== "approved") {
      await supabase
        .from("team_registration")
        .update({ status: "approved", approved_at: new Date().toISOString(), approved_by_id: ADMIN_ACCOUNT_ID })
        .eq("id", elemanRegId);
      console.log(`✓ registración eleman aprobada (antes: ${elemanReg.status})`);
    } else {
      console.log(`✓ registración eleman ya aprobada: ${elemanRegId}`);
    }
  } else {
    const CIV_POOL = [
      "britons", "franks", "goths", "teutons", "japanese", "chinese", "byzantines", "persians", "saracens", "turks",
      "vikings", "mongols", "celts", "spanish", "aztecs", "mayans", "huns", "koreans", "italians", "hindustanis",
      "incas", "magyars", "slavs", "berbers", "ethiopians", "malians", "portuguese", "burmese", "khmer", "malay",
    ];
    const baseCount = edition.civs_base ?? 9;
    const extraCount = edition.civs_extra_finalist ?? 3;
    const shuffled = [...CIV_POOL].sort(() => Math.random() - 0.5);
    const civs = shuffled.slice(0, baseCount + extraCount);

    const now = new Date().toISOString();
    const { data: newReg, error: regErr } = await supabase
      .from("team_registration")
      .insert({
        team_account_id: elemanTeamId,
        tournament_edition_id: edition.id,
        base_civ_ids: civs.slice(0, baseCount),
        extra_civ_ids: civs.slice(baseCount),
        elo_freeze_snapshot: 3000,
        elo_verification_status: "verified",
        status: "approved",
        restream_accepted: true,
        handbook_downloaded_at: now,
        terms_accepted_at: now,
        submitted_at: now,
        approved_at: now,
        approved_by_id: ADMIN_ACCOUNT_ID,
      })
      .select("id")
      .single();
    if (regErr) throw new Error(`crear registración eleman: ${regErr.message}`);
    elemanRegId = newReg.id;
    console.log(`✓ registración eleman creada: ${elemanRegId}`);

    // 3 jugadores
    const { error: plErr } = await supabase.from("player_registration").insert([
      { team_registration_id: elemanRegId, aoe2_profile_id: 300001, display_name: "eleman3007", country: "JP", clan: "ELEM", is_verified: true, max_rating_rm_1v1: 1000, rating_rm_1v1_current: 950, is_captain: true, linked_profiles: [] },
      { team_registration_id: elemanRegId, aoe2_profile_id: 300002, display_name: "eleman P2", country: "JP", clan: "ELEM", is_verified: true, max_rating_rm_1v1: 1000, rating_rm_1v1_current: 950, is_captain: false, linked_profiles: [] },
      { team_registration_id: elemanRegId, aoe2_profile_id: 300003, display_name: "eleman P3", country: "JP", clan: "ELEM", is_verified: true, max_rating_rm_1v1: 1000, rating_rm_1v1_current: 950, is_captain: false, linked_profiles: [] },
    ]);
    if (plErr) throw new Error(`crear jugadores eleman: ${plErr.message}`);
    console.log(`✓ 3 jugadores de eleman creados`);

    // Inventario de comodines
    const { error: invErr } = await supabase.from("comodin_inventory").insert({
      team_registration_id: elemanRegId,
      reroll_available: edition.comodin_reroll ?? 2,
      anular_available: edition.comodin_anular ?? 1,
      elegir_rival_available: edition.comodin_elegir_rival ?? 1,
      invocar_pro_available: edition.comodin_invocar_pro ?? 1,
    });
    if (invErr && invErr.code !== "23505") throw new Error(`inventario eleman: ${invErr.message}`);
    console.log(`✓ inventario de comodines de eleman creado`);
  }

  // ─── 4. Reemplazar PSX por eleman en la primera llave ────────
  const { data: match } = await supabase
    .from("match")
    .select("id, team_a_id, team_b_id, status")
    .eq("id", MATCH_ID)
    .single();
  if (!match) throw new Error(`match ${MATCH_ID} no encontrado`);

  const PSX_REG_ID = "10a23d89-8c82-41fe-a28b-11a502f863e7";
  if (match.team_a_id === PSX_REG_ID) {
    await supabase.from("match").update({ team_a_id: elemanRegId }).eq("id", MATCH_ID);
    console.log(`✓ team_a de la llave: PSX → eleman3007`);
  } else if (match.team_b_id === PSX_REG_ID) {
    await supabase.from("match").update({ team_b_id: elemanRegId }).eq("id", MATCH_ID);
    console.log(`✓ team_b de la llave: PSX → eleman3007`);
  } else {
    console.log(`— PSX no está en esta llave, no se reemplaza`);
  }

  // ─── 5. Borrar draws y games de la llave ──────────────────────
  const { data: games } = await supabase
    .from("match_game")
    .select("id, draw_id")
    .eq("match_id", MATCH_ID);

  if (games?.length) {
    const drawIds = games.map((g) => g.draw_id).filter(Boolean);
    if (drawIds.length) {
      await supabase.from("roulette_draw").delete().in("id", drawIds);
      console.log(`✓ ${drawIds.length} draws borrados`);
    }
    await supabase.from("match_game").delete().eq("match_id", MATCH_ID);
    console.log(`✓ ${games.length} match_games borrados`);
  } else {
    console.log(`— no hay match_games en esta llave`);
  }

  // ─── 6. Resetear el match a estado limpio ─────────────────────
  await supabase
    .from("match")
    .update({
      status: "scheduled",
      winner_team_id: null,
      score_a: 0,
      score_b: 0,
      draw_seed: null,
      finished_at: null,
      ready_lineup_a_at: null,
      ready_lineup_b_at: null,
      comodin_window_expires_at: null,
    })
    .eq("id", MATCH_ID);
  console.log(`✓ match reseteado a 'scheduled' sin sorteado`);

  // ─── 7. Limpiar el slot del padre (Octavos) ───────────────────
  const { data: parent } = await supabase
    .from("match")
    .select("id, parent_match_a_id, parent_match_b_id, team_a_id, team_b_id, status")
    .or(`parent_match_a_id.eq.${MATCH_ID},parent_match_b_id.eq.${MATCH_ID}`)
    .maybeSingle();

  if (parent?.id) {
    await supabase
      .from("match")
      .update({ team_a_id: null, team_b_id: null, status: "scheduled" })
      .eq("id", parent.id);
    console.log(`✓ match padre (${parent.id}) limpiado`);
  } else {
    console.log(`— no hay match padre que limpiar`);
  }

  // ─── Verificación final ───────────────────────────────────────
  const { data: final } = await supabase
    .from("match")
    .select("id, status, team_a_id, team_b_id, score_a, score_b, winner_team_id")
    .eq("id", MATCH_ID)
    .single();

  const teamName = async (regId) => {
    if (!regId) return "—";
    const { data } = await supabase
      .from("team_registration")
      .select("team_account:team_account_id ( name )")
      .eq("id", regId)
      .single();
    return data?.team_account?.name ?? "—";
  };

  console.log("\n=== RESULTADO FINAL ===");
  console.log(`  Match: ${final.id}`);
  console.log(`  Status: ${final.status}`);
  console.log(`  Team A: ${await teamName(final.team_a_id)}`);
  console.log(`  Team B: ${await teamName(final.team_b_id)}`);
  console.log(`  Score: ${final.score_a} : ${final.score_b}`);
  console.log(`  Winner: ${final.winner_team_id ?? "—"}`);
  console.log(`  Draws/Games: borrados`);
  console.log(`  Padre: limpio`);
}

main().catch((e) => { console.error("Fatal:", e.message ?? e); process.exit(1); });
