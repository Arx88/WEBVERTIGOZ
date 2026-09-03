#!/usr/bin/env node
/** Lista los equipos aprobados de la edición activa con su dueño (read-only). */
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

const get = async (path) => {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

const main = async () => {
  const editions = await get("tournament_edition?select=id,name&status=eq.registration&limit=1");
  const ed = editions[0];

  // Registrations aprobadas con el equipo y su dueño
  const regs = await get(
    `team_registration?select=id,status,created_at,approved_at,team_account:team_account_id(id,name,owner:owner_id(email,display_name))&tournament_edition_id=eq.${ed.id}&status=eq.approved&order=approved_at.asc`
  );

  console.log(`Total aprobados: ${regs.length} (tope 32)\n`);
  regs.forEach((r, i) => {
    const t = r.team_account;
    const owner = t?.owner?.email ?? "sin-email";
    const kind = /vertigo\.test|seed|test/i.test(owner) ? "[TEST]" : "[REAL?]";
    console.log(
      `${String(i + 1).padStart(2)}. ${t?.name ?? "?"} — ${owner} ${kind} — aprobada ${r.approved_at?.slice(0, 16) ?? "?"}`
    );
  });
};

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
