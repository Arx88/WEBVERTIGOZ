/**
 * Semilla de DEMO para apuestas: crea cuentas espectador falsas y les hace
 * apuestas repartidas en las llaves programadas, para ver la UI con pozos,
 * barras A vs B, % del pozo, countdown y ranking con gente.
 *
 * Uso:
 *   node scripts/seed-apuestas-demo.mjs          # siembra (limpia demo previo)
 *   node scripts/seed-apuestas-demo.mjs --clean  # borra SOLO las cuentas demo
 *
 * Las cuentas demo se identifican por email *@demo-apuestas.vertigo.test
 * y se pueden loguear con la contraseña DemoApuesta2026!
 */

import postgres from "postgres";

const PW = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD ?? "RebelbyteEra1-");
const sql = postgres(
  `postgresql://postgres.tomlvgzwleolsxksiygs:${PW}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  { prepare: false, max: 1 }
);

const DEMO_DOMAIN = "demo-apuestas.vertigo.test";
const DEMO_PASS = "DemoApuesta2026!";

const NAMES = [
  "ElTactico",
  "MesaDeBar",
  "GritoDeHincha",
  "LaBoletaNegra",
  "OjoDeHalcon",
  "DonRulos",
  "DoñaRosa",
  "PunteriaCiega",
];

// [matchIdx, spectatorIdx, side("A"|"B"), stake] — mezcla pensada para que
// las barras se vean distintas entre llaves (cómodo, aplastado, parejo).
const BET_PLAN = [
  // M0 — 8 apostadores, 59/41
  [0, 0, "A", 200], [0, 1, "B", 150], [0, 2, "A", 300], [0, 3, "B", 100],
  [0, 4, "A", 250], [0, 5, "A", 50], [0, 6, "B", 400], [0, 7, "A", 150],
  // M1 — 6 apostadores, 19/81 (todos arriba del B)
  [1, 0, "B", 300], [1, 1, "B", 200], [1, 2, "A", 100],
  [1, 3, "B", 350], [1, 4, "A", 150], [1, 5, "B", 250],
  // M2 — 5 apostadores, casi parejo
  [2, 0, "A", 100], [2, 1, "A", 300], [2, 2, "B", 200],
  [2, 3, "A", 50], [2, 4, "B", 300],
  // M3 — 4 apostadores, 61/39
  [3, 1, "A", 250], [3, 3, "B", 200], [3, 5, "A", 300], [3, 6, "B", 150],
];

function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function clean() {
  // 1) Cuentas demo en public.account (cascada: wallet + bets)
  const accs = await sql`
    DELETE FROM account WHERE email LIKE ${"%@" + DEMO_DOMAIN} RETURNING id`;
  // 2) Usuarios demo en auth (incluye huérfanos de corridas parciales)
  const users = await sql`
    DELETE FROM auth.users WHERE email LIKE ${"%@" + DEMO_DOMAIN} RETURNING id`;
  console.log(`Limpieza: ${accs.length} cuentas y ${users.length} usuarios demo eliminados.`);
}

async function seed() {
  await clean();

  const matches = await sql`
    SELECT id, team_a_id, team_b_id FROM match
    WHERE status = 'scheduled' AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL
    ORDER BY scheduled_at_start ASC NULLS LAST
    LIMIT 4`;
  if (matches.length === 0) throw new Error("No hay llaves programadas con equipos.");
  console.log(`Llaves a sembrar: ${matches.length}`);

  // Cuentas espectador demo (el trigger les da wallet de 1000)
  const accIds = [];
  for (const name of NAMES) {
    const email = `${slug(name)}@${DEMO_DOMAIN}`;
    const [u] = await sql`
      INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${email},
              crypt(${DEMO_PASS}, gen_salt('bf')), now(), now(), now())
      RETURNING id`;
    // Un trigger de la base auto-crea la fila account al insertar en auth.users
    // (rol owner, display_name nulo): la promovemos a espectador en vez de insertar.
    let [acc] = await sql`
      UPDATE account SET role = 'spectator', display_name = ${name}, email = ${email}, updated_at = now()
      WHERE supabase_auth_id = ${u.id}
      RETURNING id`;
    if (!acc) {
      [acc] = await sql`
        INSERT INTO account (supabase_auth_id, email, role, display_name)
        VALUES (${u.id}, ${email}, 'spectator', ${name})
        RETURNING id`;
    }
    accIds.push(acc.id);
  }
  console.log(`Cuentas demo creadas: ${accIds.length} (pass: ${DEMO_PASS})`);

  // Apuestas (el trigger debita del wallet)
  for (const [m, s, side, stake] of BET_PLAN) {
    const match = matches[m];
    if (!match) continue;
    const teamId = side === "A" ? match.team_a_id : match.team_b_id;
    await sql`
      INSERT INTO bet (spectator_account_id, match_id, picked_team_id, stake)
      VALUES (${accIds[s]}, ${match.id}, ${teamId}, ${stake})`;
  }

  // Resumen por llave
  for (let m = 0; m < matches.length; m++) {
    const match = matches[m];
    const rows = await sql`
      SELECT picked_team_id, COUNT(*) n, SUM(stake) total FROM bet
      WHERE match_id = ${match.id} GROUP BY picked_team_id`;
    const a = rows.find((r) => r.picked_team_id === match.team_a_id);
    const b = rows.find((r) => r.picked_team_id === match.team_b_id);
    const sa = a ? Number(a.total) : 0;
    const sb = b ? Number(b.total) : 0;
    const pool = sa + sb;
    console.log(
      `Llave ${m + 1}: pozo ${pool} pts · ${(pool ? Math.round((sa / pool) * 100) : 50)}% A vs ${(
        pool ? Math.round((sb / pool) * 100) : 50
      )}% B · ${Number(a?.n ?? 0) + Number(b?.n ?? 0)} apostadores`
    );
  }

  const wallets = await sql`
    SELECT SUM(balance)::int total FROM spectator_wallet
    WHERE account_id IN ${sql(accIds)}`;
  console.log(`Saldo restante sumado en wallets demo: ${wallets[0].total}`);
}

const isClean = process.argv.includes("--clean");
try {
  if (isClean) await clean();
  else await seed();
} finally {
  await sql.end();
}
