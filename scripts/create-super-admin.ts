/**
 * Script para crear super_admin con manejo de errores detallado.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const EMAIL = process.argv[2] || "valastrojp@gmail.com";

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Creando usuario: ${EMAIL}`);

  // Crear usuario SIN password (enviamos invite email)
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
    user_metadata: { role: "super_admin", display_name: "Acido" },
  });

  if (createErr) {
    console.error(`Error (${createErr.name}):`, createErr.message);
    if (createErr.stack) console.error(createErr.stack);
    process.exit(1);
  }

  console.log(`✓ Usuario creado: id=${newUser.user.id}`);

  // Upsert account (con bypass RLS via service role)
  const { error: upsertErr } = await supabase
    .from("account")
    .upsert({
      supabase_auth_id: newUser.user.id,
      email: EMAIL,
      role: "super_admin",
      display_name: "Acido",
    }, { onConflict: "supabase_auth_id" });

  if (upsertErr) {
    console.error("Error upsert account:", upsertErr.message);
  } else {
    console.log("✓ Account upsert OK");
  }

  // Generar invite link (para que el usuario setee su password)
  const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(EMAIL, {
    redirectTo: "https://webvertigo.vercel.app/admin",
  });

  if (inviteErr) {
    console.log("(invite ya enviado o error):", inviteErr.message);
  } else {
    console.log("✓ Invite email enviado");
  }

  console.log(`\nListo. ${EMAIL} es super_admin.`);
  console.log("Revisá tu email para setear la password.");
}

main();
