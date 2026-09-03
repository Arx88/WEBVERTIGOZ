#!/usr/bin/env node
/** Lista triggers y columnas NOT NULL sin default de team_registration (read-only). */
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
const sql = postgres(
  `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  { prepare: false, max: 1 }
);

const triggers = await sql`
  SELECT tgname, pg_get_triggerdef(t.oid) AS def
  FROM pg_trigger t
  WHERE tgrelid = 'team_registration'::regclass AND NOT tgisinternal`;
console.log("TRIGGERS en team_registration:");
for (const t of triggers) console.log(` - ${t.tgname}: ${t.def.slice(0, 140)}`);

const cols = await sql`
  SELECT column_name, is_nullable, column_default, data_type
  FROM information_schema.columns
  WHERE table_name = 'team_registration' AND is_nullable = 'NO' AND column_default IS NULL`;
console.log("\nNOT NULL sin default:");
for (const c of cols) console.log(` - ${c.column_name} (${c.data_type})`);

await sql.end();
