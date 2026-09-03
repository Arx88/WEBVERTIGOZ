#!/usr/bin/env node
/**
 * Diagnóstico read-only del exceso de inscripciones (33/32).
 * Usa SUPABASE_SERVICE_ROLE_KEY de .env.local SOLO para SELECT.
 * No modifica ningún dato.
 */
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const get = async (path) => {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

const main = async () => {
  // 1. Ediciones con su tope
  const editions = await get(
    "tournament_edition?select=id,name,status,max_teams&order=created_at.desc&limit=3"
  );
  console.log("EDICIONES:", editions.map((e) => `${e.name} [${e.status}] tope=${e.max_teams}`).join(" | "));

  for (const ed of editions.slice(0, 2)) {
    console.log(`\n== ${ed.name} (${ed.id.slice(0, 8)}…) tope=${ed.max_teams} ==`);
    // 2. Conteo por status
    const regs = await get(
      `team_registration?select=id,status,payment_confirmed,payment_deadline_at,approved_at,created_at&tournament_edition_id=eq.${ed.id}&order=created_at.asc`
    );
    const byStatus = {};
    for (const r of regs) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    console.log("Por estado:", JSON.stringify(byStatus));

    const approved = regs.filter((r) => r.status === "approved");
    // 3. Aprobados que ocupan slot vs. vencidos sin pagar (cron miss)
    const now = Date.now();
    const overdueUnpaid = approved.filter(
      (r) => !r.payment_confirmed && r.payment_deadline_at && new Date(r.payment_deadline_at) < now
    );
    console.log(`Aprobados: ${approved.length}`);
    console.log(
      "Aprobados con pago confirmado:",
      approved.filter((r) => r.payment_confirmed).length
    );
    console.log(
      "Aprobados sin pagar y plazo VENCIDO (debió expirar el cron):",
      overdueUnpaid.length
    );
    for (const r of overdueUnpaid.slice(0, 5)) {
      console.log(
        `  - reg ${r.id.slice(0, 8)}… aprobada ${r.approved_at}, venció ${r.payment_deadline_at}`
      );
    }
    // 4. Ultimas 3 aprobadas (orden real)
    console.log(
      "Últimas aprobadas:",
      approved
        .sort((a, b) => (b.approved_at ?? "").localeCompare(a.approved_at ?? ""))
        .slice(0, 3)
        .map((r) => `${r.id.slice(0, 8)}… pagó=${r.payment_confirmed} aprobada=${r.approved_at}`)
        .join(" | ")
    );
  }
};

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
