import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

/**
 * POST /api/admin/exec-sql
 *
 * Endpoint TEMPORAL para ejecutar SQL en Supabase desde Vercel (que tiene IPv6).
 * Válido solo para setup inicial — será eliminado después.
 *
 * Header requerido: x-admin-token (secreto compartido)
 * Body: { sql: string }
 *
 * Devuelve: { ok, rows? }
 */

const ADMIN_TOKEN = process.env.ADMIN_EXEC_TOKEN || "vertigo-setup-temp-token-2026";

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar token
    const token = req.headers.get("x-admin-token");
    if (token !== ADMIN_TOKEN) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Leer SQL del body
    const { sql } = await req.json();
    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "SQL requerido" }, { status: 400 });
    }

    // 3. Verificar DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        { error: "DATABASE_URL no configurada en este entorno" },
        { status: 500 }
      );
    }

    // 4. Ejecutar SQL
    const sqlClient = postgres(dbUrl, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });

    try {
      const result = await sqlClient.unsafe(sql);
      // postgres devuelve un array de rows
      const rows = Array.isArray(result) ? result : [];
      return NextResponse.json({
        ok: true,
        rowCount: rows.length,
        rows: rows.slice(0, 50), // limitar a 50 rows para no explotar la response
      });
    } finally {
      await sqlClient.end();
    }
  } catch (err) {
    console.error("[exec-sql] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
