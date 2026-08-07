#!/usr/bin/env node
/**
 * Ejecuta el fix-trigger.sql en la DB via el endpoint /api/admin/exec-sql de Vercel.
 */

import fs from "fs";

const URL = "https://webvertigo.vercel.app/api/admin/exec-sql";
const TOKEN = "vertigo-setup-temp-token-2026-a8f3k2";

async function main() {
  const sqlFile = process.argv[2] || "scripts/fix-trigger-query.sql";
  const sql = fs.readFileSync(sqlFile, "utf-8");

  console.log(`Ejecutando ${sqlFile} (${sql.length} chars)...`);

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": TOKEN,
    },
    body: JSON.stringify({ sql }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`✗ Error HTTP ${res.status}:`, data);
    process.exit(1);
  }

  console.log("✓ Respuesta:", JSON.stringify(data, null, 2));
}

main();
