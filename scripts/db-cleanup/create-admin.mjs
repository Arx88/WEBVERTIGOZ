/**
 * Crea (o actualiza) un usuario staff: auth + espejo account con rol admin.
 * Uso: node scripts/db-cleanup/create-admin.mjs <email> <password> [role]
 * (el password via por argv — nunca se guarda en el repo)
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const [email, password, role = "super_admin"] = process.argv.slice(2);
if (!email || !password) {
  console.error("uso: node create-admin.mjs <email> <password> [super_admin|admin]");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("faltan env"); process.exit(1); }
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) Buscar o crear el usuario en auth
let userId;
const { data: listed } = await supabase.auth.admin.listUsers();
const found = listed?.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
if (found) {
  userId = found.id;
  console.log("— auth: usuario ya existía", userId);
} else {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { role },
  });
  if (error) { console.error("ERROR createUser:", error.message); process.exit(1); }
  userId = created.user.id;
  console.log("— auth: usuario creado", userId);
}

// 2) Asegurar password confirmado (aunque ya existiera)
const { error: upErr } = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
if (upErr) console.error("— aviso updateUserById:", upErr.message);

// 3) Espejo public.account con el rol pedido (el trigger lo crea como owner)
const { connectDb } = await import("./connect.mjs");
const db = await connectDb();
await db.query(
  `insert into account (supabase_auth_id, email, role)
   values ($1, $2, $3)
   on conflict (supabase_auth_id) do update set role = excluded.role, updated_at = now()`,
  [userId, email, role]
);
const { rows } = await db.query(
  "select email, role, display_name from account where supabase_auth_id = $1",
  [userId]
);
console.log("— account:", rows[0]);
const { rows: total } = await db.query("select role, count(*)::int n from account group by role order by role");
console.log("— cuentas por rol:", total);
await db.end();
