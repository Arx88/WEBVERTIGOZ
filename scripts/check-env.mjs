/**
 * check-env.mjs — Valida variables de entorno sin exponer secretos.
 *
 * Uso: node scripts/check-env.mjs
 *
 * Chequea:
 *  1. Presencia de todas las vars que exige el código (mismo set que .env.example).
 *  2. Formato (URLs, JWTs, largo de tokens, placeholders sin reemplazar).
 *  3. Coherencia: role/ref de las keys de Supabase contra NEXT_PUBLIC_SUPABASE_URL.
 *  4. Conectividad real: Supabase Auth/REST con anon + service key, y SELECT 1 a Postgres.
 */
import { config as loadDotenv } from "dotenv";
import postgres from "postgres";

// Mimica el orden de Next.js: .env primero, .env.local pisa
loadDotenv();
loadDotenv({ path: ".env.local" });

const mask = (v) => {
  if (!v) return "(vacío)";
  if (v.length <= 8) return "*".repeat(v.length);
  return v.slice(0, 4) + "*".repeat(10) + `… (${v.length} chars)`;
};

const decodeJwtPayload = (jwt) => {
  try {
    const payload = jwt.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const results = [];
const ok = (name, msg = "") => results.push({ status: "ok", name, msg });
const warn = (name, msg = "") => results.push({ status: "warn", name, msg });
const fail = (name, msg = "") => results.push({ status: "fail", name, msg });

console.log("═".repeat(62));
console.log("  VÉRTIGO Cup — chequeo de variables de entorno (.env.local)");
console.log("═".repeat(62));
console.log("  (los valores se muestran enmascarados a propósito)\n");

// ─── 1. Presencia ────────────────────────────────────────────
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_PASSWORD",
  "ADMIN_EXEC_TOKEN",
  "NEXT_PUBLIC_APP_URL",
];
for (const name of required) {
  const v = process.env[name];
  if (!v || !v.trim()) fail(name, "NO está definida — la app va a fallar");
  else ok(name, mask(v));
}

// ─── 2. Formato ──────────────────────────────────────────────
console.log("\n── Formato ──────────────────────────────────────────");

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const refFromUrl = supaUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i)?.[1];

if (supaUrl) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(supaUrl.replace(/\/$/, "")))
    warn("NEXT_PUBLIC_SUPABASE_URL", `formato inusual: no es https://{ref}.supabase.co — ${supaUrl.replace(/\/$/, "")}`);
  else ok("NEXT_PUBLIC_SUPABASE_URL", `formato OK (ref: ${refFromUrl})`);
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

for (const [name, key] of [["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey], ["SUPABASE_SERVICE_ROLE_KEY", serviceKey]]) {
  if (!key) continue;
  const payload = decodeJwtPayload(key);
  if (!payload) fail(name, "no parece un JWT de Supabase (debería empezar con eyJ...)");
  else ok(name, `JWT válido, role="${payload.role}"${payload.ref ? `, ref="${payload.ref}"` : ""}`);
}

// Coherencia: keys no intercambiadas / del proyecto correcto
if (refFromUrl) {
  const anonPayload = decodeJwtPayload(anonKey);
  const servicePayload = decodeJwtPayload(serviceKey);
  if (anonPayload?.ref && anonPayload.ref !== refFromUrl)
    fail("NEXT_PUBLIC_SUPABASE_ANON_KEY", `ref "${anonPayload.ref}" ≠ ref de la URL "${refFromUrl}" (¿key de otro proyecto?)`);
  if (servicePayload?.ref && servicePayload.ref !== refFromUrl)
    fail("SUPABASE_SERVICE_ROLE_KEY", `ref "${servicePayload.ref}" ≠ ref de la URL "${refFromUrl}" (¿key de otro proyecto?)`);
  if (servicePayload?.role && servicePayload.role !== "service_role")
    fail("SUPABASE_SERVICE_ROLE_KEY", `role="${servicePayload.role}" — parece anon key pegada donde va la service role key`);
  if (anonPayload?.role && anonPayload.role !== "anon")
    warn("NEXT_PUBLIC_SUPABASE_ANON_KEY", `role="${anonPayload.role}" (esperado "anon")`);
}

const dbUrl = process.env.DATABASE_URL ?? "";
if (dbUrl) {
  if (!/^postgres(ql)?:\/\//.test(dbUrl)) fail("DATABASE_URL", "no arranca con postgres:// o postgresql://");
  else ok("DATABASE_URL", "scheme OK");
} else {
  warn("DATABASE_URL", "no definida — la app no la usa (conecta vía Supabase-js), pero db:generate / db:push / db:studio van a fallar");
}

const adminToken = process.env.ADMIN_EXEC_TOKEN ?? "";
if (adminToken) {
  if (/generar-token|cambiar|placeholder/i.test(adminToken)) fail("ADMIN_EXEC_TOKEN", "sigue siendo el placeholder del .env.example");
  else if (adminToken.length < 32)
    warn("ADMIN_EXEC_TOKEN", `funciona pero es débil (${adminToken.length} chars, parece dummy) — generar uno fuerte con: openssl rand -hex 32`);
  else ok("ADMIN_EXEC_TOKEN", `largo OK (${adminToken.length} chars)`);
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
if (appUrl && !/^https?:\/\//.test(appUrl)) warn("NEXT_PUBLIC_APP_URL", `no es una URL http(s): "${appUrl}"`);

// ─── 3. Opcionales ───────────────────────────────────────────
console.log("\n── Opcionales ───────────────────────────────────────");

const gmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const resend = !!process.env.RESEND_API_KEY;
if (gmail) ok("EMAIL (GMAIL_USER + GMAIL_APP_PASSWORD)", "transporte SMTP configurado");
else if (resend) ok("EMAIL (RESEND_API_KEY)", "transporte Resend configurado");
else warn("EMAIL (GMAIL/RESEND)", "sin configurar — los mails de invitación/recordatorios no se van a enviar");

const cron = process.env.CRON_SECRET;
if (cron) ok("CRON_SECRET", mask(cron));
else warn("CRON_SECRET", "no definida — OK en dev, PERO los cron routes van a 401 en producción");

if (process.env.AOE2_COMPANION_API_URL) ok("AOE2_COMPANION_API_URL", "custom (si no, usa el default)");
else ok("AOE2_COMPANION_API_URL", "usa default: https://data.aoe2companion.com/api");

// ─── 4. Conectividad real ────────────────────────────────────
console.log("\n── Conectividad (checks reales) ─────────────────────");

if (supaUrl) {
  const base = supaUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) ok("Supabase Auth", `health OK (${res.status}) con anon key`);
    else if (res.status === 401) fail("Supabase Auth", `401 — la anon key fue rechazada`);
    else fail("Supabase Auth", `HTTP ${res.status}`);
  } catch (e) {
    fail("Supabase Auth", `no responde: ${e.cause?.code ?? e.message}`);
  }

  if (serviceKey) {
    try {
      const res = await fetch(`${base}/rest/v1/`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) ok("Supabase REST + service key", `OK (${res.status})`);
      else if (res.status === 401 || res.status === 403) fail("Supabase REST + service key", `HTTP ${res.status} — la service role key fue rechazada`);
      else fail("Supabase REST + service key", `HTTP ${res.status}`);
    } catch (e) {
      fail("Supabase REST + service key", `no responde: ${e.cause?.code ?? e.message}`);
    }
  }
}

if (dbUrl) {
  let sql;
  try {
    sql = postgres(dbUrl, { max: 1, connect_timeout: 10, idle_timeout: 5 });
    const [{ now }] = await sql`select now()`;
    ok("DATABASE_URL (Postgres)", `conexión OK — server time ${new Date(now).toISOString()}`);
  } catch (e) {
    fail("DATABASE_URL (Postgres)", `no conecta: ${e.message}`);
  } finally {
    if (sql) await sql.end({ timeout: 2 });
  }
} else if (refFromUrl && process.env.SUPABASE_DB_PASSWORD) {
  // Sin DATABASE_URL: verificar credenciales reales contra el pooler de Supabase
  // (mismo mecanismo que scripts/db-cleanup/connect.mjs)
  const REGIONS = [
    "sa-east-1", "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1",
    "eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "eu-north-2",
    "ap-south-1", "ap-south-2", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
    "ap-east-1", "me-central-1", "me-south-1", "af-south-1", "il-central-1",
  ];
  const PREFIXES = [1, 0, 2]; // aws-0 retirado por Supabase, aws-1 es el actual
  let connected = false;
  let lastErr = "";
  outer: for (const p of PREFIXES) {
    for (const region of REGIONS) {
      const host = `aws-${p}-${region}.pooler.supabase.com`;
      let sql;
      try {
        sql = postgres(`postgresql://postgres.${refFromUrl}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@${host}:5432/postgres`, {
          max: 1, connect_timeout: 4, idle_timeout: 2, ssl: "prefer",
        });
        await sql`select 1`;
        ok("SUPABASE_DB_PASSWORD (pooler)", `conexión OK vía ${host}`);
        connected = true;
        break outer;
      } catch (e) {
        lastErr = String(e.message ?? e);
      } finally {
        if (sql) await sql.end({ timeout: 1 }).catch(() => {});
      }
    }
  }
  if (!connected) fail("SUPABASE_DB_PASSWORD (pooler)", `no pude conectar en ninguna región — última: ${lastErr}`);
}

// ─── Resumen ─────────────────────────────────────────────────
console.log("\n" + "═".repeat(62));
let fails = 0, warns = 0;
for (const r of results) {
  const icon = r.status === "ok" ? " ✔" : r.status === "warn" ? " ⚠ " : " ✖";
  if (r.status === "fail") fails++;
  if (r.status === "warn") warns++;
  const msg = r.msg ? ` — ${r.msg}` : "";
  console.log(`${icon} ${r.name}${msg}`);
}
console.log("═".repeat(62));
console.log(`  Resultado: ${fails} errores, ${warns} avisos\n`);

if (fails > 0) {
  console.log("✖ Hay variables rotas o faltantes — la app no va a funcionar bien hasta corregirlas.");
  process.exit(1);
} else if (warns > 0) {
  console.log("⚠ Lo esencial está OK, pero revisá los avisos de arriba.");
} else {
  console.log("✔ Todas las variables están cargadas y funcionales.");
}
