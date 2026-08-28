/**
 * Reparación post replace-emblems: los 12 match-by-name fueron pisados por el
 * reparto genérico. Los restauro (sus emblemas siguen libres) y luego asigno
 * emblemas libres a los equipos que quedaron con emblem_id NULL.
 */
import { connectDb } from "./connect.mjs";

/** team_account.name → emblema nuevo que le correspondía por su animal viejo. */
const RESTORE = {
  "PSX": "León",
  "PAPÁ de cristian": "Grifo",
  "Trono de Hierro": "Águila",
  "Clan de la Tormenta": "Dragón",
  "Guardia del Fénix": "Lobo",
  "Pueblo de la Niebla": "Cuervo",
  "Lobos Esteparios": "Oso",
  "Corona Rota": "Halcón",
  "Vanguardia Real": "Serpiente",
  "Los Inquebrantables": "Toro",
  "Orden del Cuervo": "Unicornio",
  "Khanato Libre": "Fénix",
};

const db = await connectDb();

// 1. Restaurar matches (solo si el emblema objetivo no lo usa otro equipo)
const taken = await db.query("SELECT e.name FROM emblem e JOIN team_account t ON t.emblem_id = e.id");
const takenNames = new Set(taken.rows.map((r) => r.name));
let restored = 0;
for (const [team, emblemName] of Object.entries(RESTORE)) {
  if (takenNames.has(emblemName)) { console.log(`· ${emblemName} ya está en uso, no restauro ${team}`); continue; }
  const r = await db.query(
    `UPDATE team_account t SET emblem_id = e.id, updated_at = now()
     FROM emblem e
     WHERE t.name = $1 AND e.name = $2 AND t.emblem_id IS NULL
     RETURNING t.name`,
    [team, emblemName]
  );
  if (r.rows.length) { restored++; takenNames.add(emblemName); console.log(`⇄ ${team} → ${emblemName} (restaurado)`); }
  else console.log(`· salto ${team} (no está con emblem_id NULL o ya tiene)`);
}

// 2. Asignar emblemas libres a los equipos que quedaron con NULL
const free = await db.query(
  `SELECT id, name FROM emblem
   WHERE is_active AND id NOT IN (SELECT emblem_id FROM team_account WHERE emblem_id IS NOT NULL)
   ORDER BY sort_order`
);
const orphans = await db.query(
  "SELECT id, name FROM team_account WHERE emblem_id IS NULL ORDER BY created_at ASC"
);
console.log(`\n▸ ${restored} restaurados | emblemas libres: ${free.rows.length} | equipos sin escudo: ${orphans.rows.length}`);

let li = 0;
for (const t of orphans.rows) {
  if (li >= free.rows.length) { console.warn(`⚠ ${t.name} queda con fallback genérico (no alcanzan los emblemas)`); continue; }
  const e = free.rows[li++];
  await db.query("UPDATE team_account SET emblem_id = $1, updated_at = now() WHERE id = $2", [e.id, t.id]);
  console.log(`★ ${t.name} → ${e.name} (reparto)`);
}

// 3. Verificación final
const check = await db.query(`
  SELECT
    (SELECT count(*)::int FROM team_account) AS teams,
    (SELECT count(*)::int FROM team_account WHERE emblem_id IS NOT NULL) AS con_escudo,
    (SELECT count(*)::int FROM (SELECT emblem_id FROM team_account WHERE emblem_id IS NOT NULL GROUP BY emblem_id HAVING count(*) > 1) d) AS repetidos,
    (SELECT count(*)::int FROM emblem WHERE is_active) AS catalogo
`);
const c = check.rows[0];
console.log(`\n■ FINAL: ${c.con_escudo}/${c.teams} equipos con escudo | repetidos: ${c.repetidos} | catálogo: ${c.catalogo} emblemas`);
await db.end();
