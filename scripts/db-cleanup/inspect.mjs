/**
 * Inspección + backup de cuentas VÉRTIGO — NO borra nada.
 * Uso: node scripts/db-cleanup/inspect.mjs
 */
import { connectDb } from "./connect.mjs";
import fs from "node:fs";
import path from "node:path";

const ADMIN_ROLES = ["admin", "super_admin"];
const client = await connectDb();

const q = (text, params) => client.query(text, params);

async function main() {
  console.log("— conectado vía pooler");

  // 1) Cuentas por rol
  const { rows: byRole } = await q(
    `SELECT role, count(*)::int AS n FROM account GROUP BY role ORDER BY role`
  );
  console.log("\n== Cuentas por rol ==\n", byRole);

  // 2) Listado completo de no-admin (lo que se borra)
  const { rows: toDelete } = await q(
    `SELECT id, supabase_auth_id, email, role, display_name, created_at
       FROM account WHERE role <> ALL($1) ORDER BY created_at`,
    [ADMIN_ROLES]
  );
  console.log(`\n== Cuentas a BORRAR (${toDelete.length}) ==`);
  for (const r of toDelete) console.log(`  [${r.role}] ${r.email}  (${r.created_at?.toISOString?.() ?? r.created_at})`);

  const { rows: admins } = await q(
    `SELECT email, role FROM account WHERE role = ANY($1) ORDER BY role`,
    [ADMIN_ROLES]
  );
  console.log(`\n== Admins que QUEDAN (${admins.length}) ==`);
  for (const r of admins) console.log(`  [${r.role}] ${r.email}`);

  const delIds = toDelete.map((r) => r.id);
  const anyToDelete = delIds.length > 0;

  // 3) Dependencias y volumen asociado
  const stats = {};
  if (anyToDelete) {
    const one = async (label, text, params = [delIds]) => {
      const { rows } = await q(text, params);
      stats[label] = rows[0]?.n ?? 0;
    };
    await one("team_account (reinos)", `SELECT count(*)::int n FROM team_account WHERE owner_id = ANY($1)`);
    await one("team_registration", `SELECT count(*)::int n FROM team_registration tr JOIN team_account ta ON ta.id = tr.team_account_id WHERE ta.owner_id = ANY($1)`);
    await one("player_registration", `SELECT count(*)::int n FROM player_registration pr JOIN team_registration tr ON tr.id = pr.team_registration_id JOIN team_account ta ON ta.id = tr.team_account_id WHERE ta.owner_id = ANY($1)`);
    await one("spectator_wallet", `SELECT count(*)::int n FROM spectator_wallet WHERE account_id = ANY($1)`);
    await one("bets", `SELECT count(*)::int n FROM bet WHERE spectator_account_id = ANY($1)`);
    await one("casters", `SELECT count(*)::int n FROM caster WHERE account_id = ANY($1)`);
    await one("roulette_draw por no-admin", `SELECT count(*)::int n FROM roulette_draw WHERE admin_id = ANY($1)`);
    await one("draw_audit_log por no-admin", `SELECT count(*)::int n FROM draw_audit_log WHERE actor_account_id = ANY($1)`);
    await one("team_registration aprobadas por no-admin", `SELECT count(*)::int n FROM team_registration WHERE approved_by_id = ANY($1)`);
    await one("comodin_usage ejecutadas por no-admin", `SELECT count(*)::int n FROM comodin_usage WHERE executed_by_account_id = ANY($1) OR revoked_by_account_id = ANY($1)`);
  }
  console.log("\n== Volumen asociado a las cuentas a borrar ==\n", stats);

  // 4) Reinos de admins (se conservan, solo se reportan)
  const { rows: adminTeams } = await q(
    `SELECT ta.name, a.email FROM team_account ta JOIN account a ON a.id = ta.owner_id WHERE a.role = ANY($1)`,
    [ADMIN_ROLES]
  );
  if (adminTeams.length) console.log("\n== OJO: reinos de admins (se conservan) ==\n", adminTeams);

  // 5) auth.users vs espejo
  try {
    const { rows: authStats } = await q(
      `SELECT
         (SELECT count(*)::int FROM auth.users) AS auth_total,
         (SELECT count(*)::int FROM auth.users u JOIN account a ON a.supabase_auth_id = u.id) AS con_espejo,
         (SELECT count(*)::int FROM auth.users u LEFT JOIN account a ON a.supabase_auth_id = u.id WHERE a.id IS NULL) AS huerfanos_auth,
         (SELECT count(*)::int FROM account a LEFT JOIN auth.users u ON u.id = a.supabase_auth_id WHERE u.id IS NULL) AS huerfanos_espejo`
    );
    console.log("\n== auth.users ==\n", authStats[0]);
  } catch (e) {
    console.log("\n(auth.users no accesible con esta conexión:", e.message, ")");
  }

  // 6) BACKUP JSON de todo lo que se borraría
  if (anyToDelete) {
    const dump = { generatedAt: new Date().toISOString(), adminRolesKept: ADMIN_ROLES, accounts: toDelete, stats, tables: {} };
    const tables = [
      ["account", `SELECT * FROM account WHERE id = ANY($1)`],
      ["team_account", `SELECT * FROM team_account WHERE owner_id = ANY($1)`],
      ["team_registration", `SELECT tr.* FROM team_registration tr JOIN team_account ta ON ta.id = tr.team_account_id WHERE ta.owner_id = ANY($1)`],
      ["player_registration", `SELECT pr.* FROM player_registration pr JOIN team_registration tr ON tr.id = pr.team_registration_id JOIN team_account ta ON ta.id = tr.team_account_id WHERE ta.owner_id = ANY($1)`],
      ["comodin_inventory", `SELECT ci.* FROM comodin_inventory ci JOIN team_registration tr ON tr.id = ci.team_registration_id JOIN team_account ta ON ta.id = tr.team_account_id WHERE ta.owner_id = ANY($1)`],
      ["spectator_wallet", `SELECT * FROM spectator_wallet WHERE account_id = ANY($1)`],
      ["bet", `SELECT * FROM bet WHERE spectator_account_id = ANY($1)`],
      ["caster", `SELECT * FROM caster WHERE account_id = ANY($1)`],
    ];
    for (const [name, sql] of tables) {
      const { rows } = await q(sql, [delIds]);
      dump.tables[name] = rows;
    }
    // Draws y audit logs por no-admin (RESTRICT: hay que borrarlos a mano)
    dump.tables.roulette_draw = (await q(`SELECT * FROM roulette_draw WHERE admin_id = ANY($1)`, [delIds])).rows;
    dump.tables.draw_audit_log = (await q(`SELECT * FROM draw_audit_log WHERE actor_account_id = ANY($1)`, [delIds])).rows;

    const out = path.resolve("scripts/db-cleanup", `backup-accounts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(out, JSON.stringify(dump, null, 2));
    console.log("\n✔ BACKUP escrito en:", out);
  } else {
    console.log("\nNo hay cuentas no-admin para borrar.");
  }
}

main()
  .catch((e) => { console.error("ERROR:", e.message, "| code:", e.code, "|", String(e).slice(0, 300)); process.exitCode = 1; })
  .finally(() => client.end());
