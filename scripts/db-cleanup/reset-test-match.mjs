/**
 * Reset de la llave de prueba PSX vs PAPÁ de cristian (match d8d2edbf).
 *
 * La llave ya se jugó (status=finished, 2-1) y su ganador se propagó a
 * Octavos por el trigger. Para volver a jugarla en la prueba:
 *   1. Limpia el team del match padre (Octavos) que vino de esta llave.
 *   2. Borra roulette_draws de los match_games de la llave.
 *   3. Borra los match_games.
 *   4. Resetea el match a scheduled, sin score, sin ganador, con fecha nueva.
 *
 * NO toca nada más del bracket. Confirmar con --yes.
 * Uso: node scripts/db-cleanup/reset-test-match.mjs --yes
 */
import { connectDb } from "./connect.mjs";

const MATCH_ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";
// Nueva fecha: mañana 21:00 Argentina = 00:00 UTC
const NEW_DATE_UTC = new Date(Date.now() + 24 * 3600 * 1000);
NEW_DATE_UTC.setUTCHours(0, 0, 0, 0); // 21:00 ART del día siguiente

const YES = process.argv.includes("--yes");

const client = await connectDb();
const q = (text, params) => client.query(text, params);

// 0) Estado previo
const { rows: before } = await q(`SELECT id, status, score_a, score_b, winner_team_id, scheduled_at_start FROM "match" WHERE id = $1`, [MATCH_ID]);
console.log("== ANTES ==", before);

if (!YES) {
  console.log("\nDRY RUN — agregá --yes para aplicar los cambios.");
  await client.end();
  process.exit(0);
}

// 1) Limpiar el slot del padre (Octavos) que recibió al ganador de esta llave.
//    El match padre se resuelve por parent_match_a_id / parent_match_b_id.
const { rows: parent } = await q(
  `SELECT m.id, m.team_a_id, m.team_b_id, m.status
     FROM "match" p
     JOIN "match" m ON m.id IN (p.parent_match_a_id, p.parent_match_b_id)
    WHERE p.id = $1`,
  [MATCH_ID]
);
console.log("\n== Match padre (Octavos) ANTES ==", parent);
if (parent[0]) {
  await q(`UPDATE "match" SET team_a_id = NULL, team_b_id = NULL, status = 'scheduled', updated_at = now() WHERE id = $1`, [parent[0].id]);
  console.log("→ padre limpiado:", parent[0].id);
}

// 2) Draws de los games de la llave
const { rows: draws } = await q(
  `SELECT id FROM roulette_draw WHERE match_game_id IN (SELECT id FROM match_game WHERE match_id = $1)`,
  [MATCH_ID]
);
if (draws.length) {
  await q(`DELETE FROM draw_audit_log WHERE draw_id = ANY($1::uuid[])`, [draws.map((d) => d.id)]);
  await q(`DELETE FROM roulette_draw WHERE id = ANY($1::uuid[])`, [draws.map((d) => d.id)]);
}
console.log(`→ draws borrados: ${draws.length}`);

// 3) match_games
await q(`DELETE FROM match_game WHERE match_id = $1`, [MATCH_ID]);

// 4) Reset del match (score_a/score_b son NOT NULL en la DB → 0)
await q(
  `UPDATE "match"
      SET status = 'scheduled', score_a = 0, score_b = 0, winner_team_id = NULL,
          scheduled_at_start = $2, finished_at = NULL, updated_at = now()
    WHERE id = $1`,
  [MATCH_ID, NEW_DATE_UTC.toISOString()]
);

const { rows: after } = await q(`SELECT id, status, score_a, score_b, winner_team_id, scheduled_at_start FROM "match" WHERE id = $1`, [MATCH_ID]);
console.log("\n== DESPUÉS ==", after);
console.log(`\n✓ Llave reseteada. Fecha: ${NEW_DATE_UTC.toISOString()} (21:00 ART)`);

await client.end();
