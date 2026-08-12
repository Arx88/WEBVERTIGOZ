import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertDevEndpointAllowed } from "@/lib/auth/dev-endpoint-guard";

/**
 * POST /api/admin/create-super-admin
 * Crea un usuario super_admin en Supabase (herramienta de DESARROLLO).
 *
 * SEGURIDAD: en producción o sin ADMIN_EXEC_TOKEN responde 404 como si la
 * ruta no existiera. En dev sigue exigiendo el header x-admin-token.
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(req: NextRequest) {
  // Bloqueo total en producción / sin token: 404 para no revelar la ruta.
  const blocked = assertDevEndpointAllowed();
  if (blocked) return blocked;

  try {
    if (!SERVICE_KEY || !SUPABASE_URL) {
      return NextResponse.json(
        { error: "Endpoint no configurado: faltan SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL" },
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

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Listar usuarios existentes
    const { data: existingUsers, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json(
        { error: `Error listando usuarios: ${listErr.message}` },
        { status: 500 }
      );
    }

    const existing = existingUsers.users.find((u) => u.email === email);
    let userId: string;

    if (existing) {
      userId = existing.id;
    } else {
      // 2. Crear usuario
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { role: "super_admin", display_name: displayName || "Admin" },
      });

      if (createErr) {
        return NextResponse.json(
          { error: `Error creando usuario: ${createErr.message}` },
          { status: 500 }
        );
      }

      userId = newUser.user.id;
    }

    // 3. Upsert en account (con service_role bypass RLS)
    const { data: existingAccount } = await supabase
      .from("account")
      .select("id")
      .eq("supabase_auth_id", userId)
      .single();

    if (existingAccount) {
      const { error: updateErr } = await supabase
        .from("account")
        .update({
          role: "super_admin",
          display_name: displayName || "Admin",
          email,
        })
        .eq("supabase_auth_id", userId);

      if (updateErr) {
        return NextResponse.json(
          { error: `Error actualizando account: ${updateErr.message}` },
          { status: 500 }
        );
      }
    } else {
      const { error: insertErr } = await supabase.from("account").insert({
        supabase_auth_id: userId,
        email,
        role: "super_admin",
        display_name: displayName || "Admin",
      });

      if (insertErr) {
        if (insertErr.code === "23505") {
          // unique violation — ya existe por trigger
          const { error: updateErr } = await supabase
            .from("account")
            .update({ role: "super_admin", display_name: displayName || "Admin", email })
            .eq("supabase_auth_id", userId);
          if (updateErr) {
            return NextResponse.json(
              { error: `Error en upsert: ${updateErr.message}` },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { error: `Error insertando account: ${insertErr.message}` },
            { status: 500 }
          );
        }
      }
    }

    // 4. Generar magic link para setear password
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    let magicLink: string | undefined;
    if (linkErr) {
      // ignore
    } else {
      magicLink = linkData.properties?.action_link;
    }

    return NextResponse.json({
      ok: true,
      userId,
      email,
      role: "super_admin",
      magicLink,
      message: magicLink
        ? "Usuario creado. Revisá el email para setear la password."
        : "Usuario creado. Iniciá sesión desde /login con tu email.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
