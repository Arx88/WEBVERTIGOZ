import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Listar usuarios existentes
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.log("Error listando:", error.message);
    return;
  }
  console.log("Usuarios existentes:", data.users.length);
  for (const u of data.users) {
    console.log(`  - ${u.email} (${u.id}) - created: ${u.created_at}`);
  }

  // Verificar cuentas en tabla account
  const { data: accounts, error: accErr } = await supabase
    .from("account")
    .select("*");
  console.log("\nAccounts en DB:", accounts?.length ?? 0, accErr?.message ?? "");
  for (const a of accounts ?? []) {
    console.log(`  - ${a.email} (auth_id: ${a.supabase_auth_id}) role: ${a.role}`);
  }
}
main();
