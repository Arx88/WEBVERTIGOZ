import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Endpoint no configurado" },
        { status: 503 }
      );
    }
    const token = req.headers.get("x-admin-token");
    if (!process.env.ADMIN_EXEC_TOKEN || token !== process.env.ADMIN_EXEC_TOKEN) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { email, displayName } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "email requerido" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const user = users.users.find((u) => u.email === email);
    if (!user) {
      return NextResponse.json(
        { error: `Usuario ${email} no encontrado.` },
        { status: 404 }
      );
    }

    const { data: existingAccount } = await supabase
      .from("account")
      .select("id")
      .eq("supabase_auth_id", user.id)
      .single();

    if (existingAccount) {
      const { error: updateErr } = await supabase
        .from("account")
        .update({
          role: "super_admin",
          display_name: displayName || "Admin",
          email,
        })
        .eq("supabase_auth_id", user.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      const { error: insertErr } = await supabase.from("account").insert({
        supabase_auth_id: user.id,
        email,
        role: "super_admin",
        display_name: displayName || "Admin",
      });
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      userId: user.id,
      email,
      role: "super_admin",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
