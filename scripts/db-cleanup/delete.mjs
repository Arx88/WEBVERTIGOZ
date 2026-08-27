/**
 * Borrado de cuentas no-admin de VÉRTIGO — DESTRUCTIVO (usa el backup de inspect.mjs).
 * Todo en una transacción. Uso: node scripts/db-cleanup/delete.mjs
 */
import { connectDb } from "./connect.mjs";

const ADMIN_ROLES = ["admin", "super_admin"];
const client = await connectDb();
const q = (text, params) => client.query(text, params);

async function main() {
  console.log("— conectado. Iniciando transacción...");
  await q("BEGIN");

  try {
    // 0) Bloquear tablas relevantes para evitar carreras
    await q(`LOCK TABLE account, team_account, team_registration, player_registration,
             comodin_inventory, spectator_wallet, bet, caster, roulette_draw, draw_audit_log
             IN EXCLUSIVE MODE`);

    // 1) IDs de cuentas no-admin
    const { rows: na } = await q(
      `SELECT id FROM account WHERE role <> ALL($1)`,
      [ADMIN_ROLES]
    );
    const ids = na.map((r) => r.id);
    console.log(`— cuentas no-admin: ${ids.length}`);
    if (ids.length === 0) {
      console.log("Nada que borrar. Commit vacío.");
      await q("COMMIT");
      return;
    }

    // 2) FKs RESTRICT hacia account: sorteos y audit logs (deben ser 0 según inspect)
    let r = await q(`DELETE FROM draw_audit_log WHERE actor_account_id = ANY($1)`, [ids]);
    console.log(`— draw_audit_log borrados: ${r.rowCount}`);
    r = await q(`DELETE FROM roulette_draw WHERE admin_id = ANY($1)`, [ids]);
    console.log(`— roulette_draw borrados: ${r.rowCount}`);

    // 3) Apuestas: por espectador no-admin Y las que apuntan a equipos que se van a borrar
    r = await q(
      `DELETE FROM bet
        WHERE spectator_account_id = ANY($1)
           OR picked_team_id IN (
             SELECT tr.id FROM team_registration tr
               JOIN team_account ta ON ta.id = tr.team_account_id
              WHERE ta.owner_id = ANY($1))`,
      [ids]
    );
    console.log(`— bets borradas: ${r.rowCount}`);

    // 4) Reinos (cascada: team_registration → player_registration, comodin_inventory)
    r = await q(`DELETE FROM team_account WHERE owner_id = ANY($1)`, [ids]);
    console.log(`— team_account (reinos) borrados: ${r.rowCount}`);

    // 5) Cuentas (cascada: spectator_wallet, caster; SET NULL: approved_by, stream_caster, etc.)
    r = await q(`DELETE FROM account WHERE id = ANY($1)`, [ids]);
    console.log(`— account borradas: ${r.rowCount}`);

    // 6) auth.users: borrar todos los que no pertenezcan a una cuenta admin
    r = await q(
      `DELETE FROM auth.users
        WHERE id NOT IN (SELECT supabase_auth_id FROM account WHERE role = ANY($1))
           OR id NOT IN (SELECT supabase_auth_id FROM account)`,
      [ADMIN_ROLES]
    );
    console.log(`— auth.users borrados: ${r.rowCount}`);

    await q("COMMIT");
    console.log("✔ COMMIT OK");
  } catch (e) {
    await q("ROLLBACK");
    console.error("✘ ERROR — ROLLBACK hecho. No se borró nada:", e.message);
    process.exitCode = 1;
    return;
  }

  // 6) Verificación final
  const { rows: v1 } = await q(`SELECT role, count(*)::int n FROM account GROUP BY role ORDER BY role`);
  const { rows: v2 } = await q(`SELECT
      (SELECT count(*)::int FROM team_account) AS reinos,
      (SELECT count(*)::int FROM team_registration) AS inscripciones,
      (SELECT count(*)::int FROM player_registration) AS jugadores,
      (SELECT count(*)::int FROM spectator_wallet) AS wallets,
      (SELECT count(*)::int FROM bet) AS apuestas,
      (SELECT count(*)::int FROM caster) AS casters,
      (SELECT count(*)::int FROM auth.users) AS auth_users`);
  const { rows: v3 } = await q(
    `SELECT email, role FROM account ORDER BY role, email`
  );
  console.log("\n== Estado final ==\ncuentas por rol:", v1, "\ntablas:", v2[0], "\ncuentas restantes:", v3);
}

main()
  .catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
