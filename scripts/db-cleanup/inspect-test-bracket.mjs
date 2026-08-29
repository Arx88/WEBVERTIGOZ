/**
 * Consulta puntual: cuentas de cristiandimitruk@gmail.com y daminanemponce@gmail.com,
 * sus team_account, inscripciones y estado de la edición activa.
 * SOLO LECTURA — no modifica nada.
 * Uso: node scripts/db-cleanup/inspect-test-bracket.mjs
 */
import { connectDb } from "./connect.mjs";

const EMAILS = ["cristiandimitruk@gmail.com", "daminanemponce@gmail.com"];

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows: accounts } = await q(
  `SELECT id, email, role, display_name FROM account WHERE email = ANY($1)`,
  [EMAILS]
);
console.log("== Cuentas ==", accounts);

const accountIds = accounts.map((a) => a.id);

const { rows: teams } = accountIds.length
  ? await q(
      `SELECT id, name, owner_id FROM team_account WHERE owner_id = ANY($1)`,
      [accountIds]
    )
  : { rows: [] };
console.log("\n== Team accounts ==", teams);

const teamIds = teams.map((t) => t.id);

const { rows: regs } = teamIds.length
  ? await q(
      `SELECT tr.id, tr.status, tr.seed, tr.tournament_edition_id, ta.name AS team_name,
              te.name AS edition_name, te.status AS edition_status
         FROM team_registration tr
         JOIN team_account ta ON ta.id = tr.team_account_id
         LEFT JOIN tournament_edition te ON te.id = tr.tournament_edition_id
        WHERE tr.team_account_id = ANY($1)
        ORDER BY tr.submitted_at DESC`,
      [teamIds]
    )
  : { rows: [] };
console.log("\n== Inscripciones ==", regs);

const { rows: edition } = await q(
  `SELECT id, name, status, max_teams FROM tournament_edition ORDER BY created_at DESC LIMIT 1`
);
console.log("\n== Última edición ==", edition);

const editionId = edition[0]?.id;
if (editionId) {
  const { rows: bracket } = await q(
    `SELECT id, type, rounds_count FROM bracket WHERE tournament_edition_id = $1`,
    [editionId]
  );
  console.log("\n== Brackets de la edición ==", bracket);

  if (bracket.length > 0) {
    const { rows: counts } = await q(
      `SELECT r.index AS round_index, r.name, count(m.id)::int AS matches,
              count(m.team_a_id)::int AS with_a, count(m.team_b_id)::int AS with_b
         FROM round r LEFT JOIN "match" m ON m.round_id = r.id
        WHERE r.bracket_id = $1
        GROUP BY r.index, r.name ORDER BY r.index`,
      [bracket[0].id]
    );
    console.log("\n== Rondas y llenado ==", counts);

    const { rows: r1 } = await q(
      `SELECT m.slot_index, m.status, m.scheduled_at_start,
              ta.name AS team_a, tb.name AS team_b,
              tra.seed AS seed_a, trb.seed AS seed_b,
              tra.team_account_id IS NOT NULL AS has_a, trb.team_account_id IS NOT NULL AS has_b
         FROM "match" m
         JOIN round r ON r.id = m.round_id
         LEFT JOIN team_registration tra ON tra.id = m.team_a_id
         LEFT JOIN team_registration trb ON trb.id = m.team_b_id
         LEFT JOIN team_account ta ON ta.id = tra.team_account_id
         LEFT JOIN team_account tb ON tb.id = trb.team_account_id
        WHERE r.bracket_id = $1 AND r.index = 0
        ORDER BY m.slot_index LIMIT 10`,
      [bracket[0].id]
    );
    console.log("\n== Primeros matches de Ronda 1 ==", r1);
  }
}

const { rows: approvedCount } = editionId
  ? await q(
      `SELECT count(*)::int n FROM team_registration WHERE tournament_edition_id = $1 AND status = 'approved'`,
      [editionId]
    )
  : { rows: [{ n: 0 }] };
console.log("\n== Aprobados en la edición ==", approvedCount[0]);

await client.end();
console.log("\n— done (solo lectura)");
