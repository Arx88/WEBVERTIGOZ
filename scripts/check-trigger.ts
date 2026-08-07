import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Usar RPC para ejecutar SQL directo (necesitamos pg_catalog access)
  // Probamos listar accounts
  const { data: accs, error: accErr } = await supabase
    .from("account")
    .select("*");
  console.log("Accounts:", accs?.length ?? 0, accErr?.message ?? "");

  // Probar el trigger directamente con un insert manual
  const { error: insErr } = await supabase
    .from("account")
    .insert({
      supabase_auth_id: "00000000-0000-0000-0000-000000000000", // dummy UUID
      email: "test@example.com",
      role: "super_admin",
      display_name: "test",
    });
  console.log("Test insert:", insErr?.message ?? "OK (rolró bien)");

  // Si llegó acá, el INSERT funciona. El problema es el trigger.
  // Borramos el dummy
  if (!insErr) {
    await supabase.from("account")
      .delete()
      .eq("supabase_auth_id", "00000000-0000-0000-0000-000000000000");
    console.log("Dummy borrado");
  }
}
main();
