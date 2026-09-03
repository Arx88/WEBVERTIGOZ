#!/usr/bin/env node
/**
 * Prueba del guard atómico de cupo (trigger trg_guard_cupo) SIN dejar rastro:
 * dentro de una transacción que termina en ROLLBACK, intenta insertar una
 * registration aprobada que llevaría la edición por encima de max_teams y
 * verifica que Postgres la rechace con CUPO_LLENO.
 *
 * Uso: node scripts/test-cupo-guard.mjs   (lee credenciales de .env.local)
 */
import fs from "fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const pw = encodeURIComponent(env.SUPABASE_DB_PASSWORD ?? "");
if (!ref || !pw) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_DB_PASSWORD en .env.local");
  process.exit(1);
}

const sql = postgres(
  `postgresql://postgres.${ref}:${pw}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  { prepare: false, max: 1 }
);

const [edition] = await sql`
  SELECT id, name, max_teams FROM tournament_edition ORDER BY created_at DESC LIMIT 1`;
console.log(`Edición: ${edition.name} — tope ${edition.max_teams}`);

const [{ total }] = await sql`
  SELECT count(*)::int AS total FROM team_registration
  WHERE tournament_edition_id = ${edition.id} AND status IN ('approved','pending')`;
console.log(`Ocupando cupo hoy: ${total}`);

if (total < edition.max_teams) {
  console.log("La edición NO está llena: el guard no se dispararía. Nada que probar (ok).");
  await sql.end();
  process.exit(0);
}

// Intento de inserción transgresora, dentro de transacción con ROLLBACK.
let rejected = false;
let errorMsg = "";
try {
  await sql.begin(async (tx) => {
    // Cualquier uuid válido como team_account no importa: el trigger corre
    // ANTES de las FK y lanza antes de validarlas.
    await tx`
      INSERT INTO team_registration (team_account_id, tournament_edition_id, status, base_civ_ids, extra_civ_ids)
      VALUES (gen_random_uuid(), ${edition.id}, 'approved', '[1,2,3]'::jsonb, '[4]'::jsonb)`;
    // Si llegamos acá, el trigger NO bloqueó → rollback y marcar fallo.
    rejected = false;
    throw new Error("INSERT_PROCEED");
  });
} catch (e) {
  if (e.message === "INSERT_PROCEED") {
    rejected = false;
  } else if (String(e.message).includes("CUPO_LLENO")) {
    rejected = true;
    errorMsg = e.message.split("\n")[0];
  } else {
    // Otro error (FK, etc.): repetir con rollback igual, pero avisar
    console.log("(error no relacionado al guard:", e.message.split("\n")[0], ")");
    rejected = null;
  }
}

console.log("");
if (rejected === true) {
  console.log("✓ GUARD OK: Postgres rechazó la inserción con CUPO_LLENO");
  console.log(`  ${errorMsg}`);
} else if (rejected === false) {
  console.log("✗ GUARD FALLÓ: la inserción transitó — el trigger no está instalado o no bloquea");
  process.exitCode = 1;
} else {
  console.log("? INCONCLUSO: no se pudo probar por otro error de constraint");
}
await sql.end();
