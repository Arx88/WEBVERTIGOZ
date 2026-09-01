/**
 * Reset final de la primera llave: eleman3007 vs PAPÁ de cristian.
 * - Borra draws/games de la llave
 * - Reset del match a 'scheduled' limpio
 * - Limpia el slot del padre (Octavos)
 * - Corrige el propagado previo (team_a del padre era PSX)
 * Uso: node scripts/db-cleanup/reset-first-key-final.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MATCH_ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";

// 1) Borrar draws de los games de la llave
const { data: games } = await supabase
  .from("match_game")
  .select("id, draw_id")
  .eq("match_id", MATCH_ID);

if (games?.length) {
  const drawIds = games.map((g) => g.draw_id).filter(Boolean);
  if (drawIds.length) {
    const { error } = await supabase.from("roulette_draw").delete().in("id", drawIds);
    if (error) console.error("borrar draws:", error.message);
    else console.log(`draws borrados: ${drawIds.length}`);
  }
  const { error } = await supabase.from("match_game").delete().eq("match_id", MATCH_ID);
  if (error) console.error("borrar games:", error.message);
  else console.log(`games borrados: ${games.length}`);
} else {
  console.log("no hay games en la llave");
}

// 2) Reset del match
const { error: mErr } = await supabase
  .from("match")
  .update({
    status: "scheduled",
    winner_team_id: null,
    score_a: 0,
    score_b: 0,
    draw_seed: null,
    finished_at: null,
    ready_a_at: null,
    ready_b_at: null,
    ready_lineup_a_at: null,
    ready_lineup_b_at: null,
    comodin_window_expires_at: null,
  })
  .eq("id", MATCH_ID)
  .select("id, status, score_a, score_b");

if (mErr) {
  console.error("reset match:", JSON.stringify(mErr, null, 1));
  process.exit(1);
}
console.log("match reseteado a 'scheduled'");

// 3) Limpiar el slot del padre (Octavos) — el team_a residual de PSX
const { data: parent } = await supabase
  .from("match")
  .select("id, parent_match_a_id, parent_match_b_id, team_a_id, team_b_id, status")
  .or(`parent_match_a_id.eq.${MATCH_ID},parent_match_b_id.eq.${MATCH_ID}`)
  .maybeSingle();

if (parent?.id) {
  const { error } = await supabase
    .from("match")
    .update({ team_a_id: null, team_b_id: null, status: "scheduled", winner_team_id: null, score_a: 0, score_b: 0 })
    .eq("id", parent.id)
    .select("id, status, team_a_id, team_b_id");
  if (error) console.error("limpiar padre:", error.message);
  else console.log(`padre limpiado: ${parent.id}`);
} else {
  console.log("no hay match padre");
}

// 4) Verificación final
const { data: final } = await supabase
  .from("match")
  .select("id, status, team_a_id, team_b_id, score_a, score_b, winner_team_id")
  .eq("id", MATCH_ID)
  .single();

const { data: teamA } = await supabase
  .from("team_registration")
  .select("team_account:team_account_id ( name )")
  .eq("id", final.team_a_id)
  .single();
const { data: teamB } = await supabase
  .from("team_registration")
  .select("team_account:team_account_id ( name )")
  .eq("id", final.team_b_id)
  .single();

console.log("\n=== ESTADO FINAL ===");
console.log(`Status: ${final.status}`);
console.log(`Team A: ${teamA?.team_account?.name ?? "—"}`);
console.log(`Team B: ${teamB?.team_account?.name ?? "—"}`);
console.log(`Score: ${final.score_a} : ${final.score_b}`);
console.log(`Winner: ${final.winner_team_id ?? "—"}`);
