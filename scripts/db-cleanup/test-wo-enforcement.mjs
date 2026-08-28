/**
 * Test end-to-end del W.O. automático (enforce-ready) usando el match de
 * prueba 142cbb11. Ejecuta el cron HTTP local con CRON_SECRET, verifica:
 *   1. Doble ausencia → forfeit sin ganador.
 *   2. Un equipo ready → forfeit con ganador + propagación al bracket.
 * Al final RESTAURA el match y su parent al estado original.
 *
 * Uso: node scripts/db-cleanup/test-wo-enforcement.mjs
 */
import fs from "node:fs";
import { connectDb, getEnv } from "./connect.mjs";

const MATCH_ID = "142cbb11-4061-46d7-9ff8-c66b06e99dbd";
const BASE = "http://localhost:3003";

function cronSecret() {
  const { env } = getEnv();
  return env.CRON_SECRET ?? "";
}

async function callCron() {
  const res = await fetch(`${BASE}/api/cron/enforce-ready`, {
    headers: { Authorization: `Bearer ${cronSecret()}` },
  });
  return { status: res.status, body: await res.json() };
}

async function getMatch(client, id) {
  const { rows } = await client.query(
    `SELECT id, status, scheduled_at_start, scheduled_at_end, jornada_label,
            ready_a_at, ready_b_at, winner_team_id, finished_at, team_a_id, team_b_id,
            round_id, slot_index
     FROM "match" WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function getParent(client, m) {
  const r = await client.query(
    `SELECT r2.id AS round_id FROM round r1
     JOIN round r2 ON r2.bracket_id = r1.bracket_id AND r2.index = r1.index + 1
     WHERE r1.id = $1`,
    [m.round_id]
  );
  if (!r.rows[0]) return null;
  const p = await client.query(
    `SELECT id, team_a_id, team_b_id FROM "match"
     WHERE round_id = $1 AND slot_index = $2`,
    [r.rows[0].round_id, Math.floor(m.slot_index / 2)]
  );
  return p.rows[0] ?? null;
}

async function restore(client, snap) {
  await client.query(
    `UPDATE "match" SET status=$2, scheduled_at_start=$3, scheduled_at_end=$4,
       jornada_label=$5, ready_a_at=$6, ready_b_at=$7, winner_team_id=$8,
       finished_at=$9, updated_at=now()
     WHERE id=$1`,
    [snap.id, snap.status, snap.scheduled_at_start, snap.scheduled_at_end,
     snap.jornada_label, snap.ready_a_at, snap.ready_b_at, snap.winner_team_id, snap.finished_at]
  );
}

let failures = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

async function main() {
  const client = await connectDb();
  try {
    const original = await getMatch(client, MATCH_ID);
    if (!original) throw new Error("Match de prueba no encontrado");
    const parentBefore = await getParent(client, original);
    console.log(`— snapshot OK (status=${original.status}, parent=${parentBefore?.id ?? "ninguno"})`);

    // ── Caso 1: doble ausencia → forfeit sin ganador ─────────────────
    const past = new Date(Date.now() - 16 * 60_000).toISOString();
    await client.query(
      `UPDATE "match" SET status='scheduled', scheduled_at_start=$2, ready_a_at=NULL,
         ready_b_at=NULL, winner_team_id=NULL, finished_at=NULL, updated_at=now()
       WHERE id=$1`,
      [MATCH_ID, past]
    );
    let r = await callCron();
    check(r.status === 200, "cron responde 200", JSON.stringify(r.body));
    let m = await getMatch(client, MATCH_ID);
    check(m.status === "forfeit", "doble ausencia → status forfeit", m.status);
    check(m.winner_team_id === null, "doble ausencia → sin ganador");
    check(!!m.finished_at, "finished_at seteado");

    // ── Caso 2: equipo A ready → gana A y propaga al parent ──────────
    await client.query(
      `UPDATE "match" SET status='scheduled', scheduled_at_start=$2, ready_a_at=now() - interval '20 minutes',
         ready_b_at=NULL, winner_team_id=NULL, finished_at=NULL, updated_at=now()
       WHERE id=$1`,
      [MATCH_ID, past]
    );
    r = await callCron();
    check(r.status === 200 && (r.body.enforced ?? 0) >= 1, "cron aplica 1 match", JSON.stringify(r.body));
    m = await getMatch(client, MATCH_ID);
    check(m.status === "forfeit", "A ready, B ausente → forfeit", m.status);
    check(m.winner_team_id === m.team_a_id, "ganador = equipo A", String(m.winner_team_id));
    if (parentBefore) {
      const parentAfter = await getMatch(client, parentBefore.id);
      const slot = original.slot_index % 2 === 0 ? parentAfter.team_a_id : parentAfter.team_b_id;
      check(slot === m.team_a_id, "ganador propagado al parent slot", String(slot));
    }

    // ── Caso 3: idempotencia — el cron no toca matches ya en forfeit ─
    r = await callCron();
    check(r.status === 200 && (r.body.enforced ?? 0) === 0, "re-corrida no aplica nada", JSON.stringify(r.body));

    // ── Restore ───────────────────────────────────────────────────────
    await restore(client, original);
    if (parentBefore) {
      await client.query(
        `UPDATE "match" SET team_a_id=$2, team_b_id=$3, updated_at=now() WHERE id=$1`,
        [parentBefore.id, parentBefore.team_a_id, parentBefore.team_b_id]
      );
    }
    const verify = await getMatch(client, MATCH_ID);
    check(verify.status === original.status, "restore: status original", verify.status);
    console.log(failures === 0 ? "\n✅ TODO OK" : `\n❌ ${failures} fallos`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
