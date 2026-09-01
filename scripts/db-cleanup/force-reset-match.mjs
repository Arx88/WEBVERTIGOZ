/**
 * Fuerza el reset del match d8d2edbf a 'scheduled', con comprobación de errores.
 * Uso: node scripts/db-cleanup/force-reset-match.mjs
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

const { data, error } = await supabase
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
  .eq("id", MATCH_ID)
  .select("id, status, score_a, score_b");

if (error) {
  console.error("UPDATE falló:", JSON.stringify(error, null, 1));
  process.exit(1);
}
console.log("UPDATE OK:", JSON.stringify(data, null, 1));
