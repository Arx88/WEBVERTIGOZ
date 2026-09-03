/**
 * Helper E2E: prepara el acceso rápido (device-trust) para una cuenta.
 *
 * El acceso rápido de /login vive en una cookie httpOnly (vc_devices) que solo
 * se crea tras un login real. En el browser fresco de Playwright no existe,
 * así que este helper siembra el dispositivo confiable directamente:
 *  1. INSERT en trusted_device (token aleatorio, guardamos su SHA-256).
 *  2. Setea la cookie vc_devices con { e: email, t: token }.
 *
 * Es el MISMO camino que recorre ensureDeviceForSession() en un login real,
 * pero sin necesitar la contraseña. Los rows se limpian en afterAll.
 */
import { createHash, randomBytes } from "crypto";
import fs from "fs";
import postgres from "postgres";

function readEnvLocal() {
  const env = {};
  if (!fs.existsSync(".env.local")) return env;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...readEnvLocal() };
const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const pw = encodeURIComponent(env.SUPABASE_DB_PASSWORD ?? "");

if (!ref || !pw) {
  throw new Error(
    "e2e/helpers/device-trust: faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_DB_PASSWORD en .env.local"
  );
}

const sql = postgres(
  `postgresql://postgres.${ref}:${pw}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  { prepare: false, max: 1 }
);

const createdTokens = [];

/**
 * Siembra el device-trust para `email` y devuelve la cookie vc_devices lista
 * para inyectar en el browser context. Si la cuenta no existe, devuelve null.
 */
export async function seedTrustedDevice(email) {
  const [account] = await sql`
    SELECT id FROM account WHERE lower(email) = ${email.toLowerCase()} LIMIT 1`;
  if (!account) return null;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();

  await sql`
    INSERT INTO trusted_device (account_id, token_hash, expires_at)
    VALUES (${account.id}, ${tokenHash}, ${expiresAt})`;
  createdTokens.push(tokenHash);

  return {
    name: "vc_devices",
    value: JSON.stringify([{ e: email, t: token }]),
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  };
}

/** Borra los trusted_device sembrados por este proceso. */
export async function cleanupSeededDevices() {
  if (!createdTokens.length) return;
  await sql`DELETE FROM trusted_device WHERE token_hash = ANY(${createdTokens})`;
  createdTokens.length = 0;
}
