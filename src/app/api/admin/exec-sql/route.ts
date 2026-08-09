import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

/**
 * POST /api/admin/exec-sql
 * Endpoint TEMPORAL para ejecutar SQL en Supabase desde Vercel.
 *
 * Estrategia: probar varias URLs de conexión al pooler IPv4 de Supabase,
 * porque la conexión directa db.{ref}.supabase.co solo tiene AAAA (IPv6)
 * y Vercel no lo resuelve.
 *
 * Header: x-admin-token
 * Body: { sql: string }
 */

const ADMIN_TOKEN = process.env.ADMIN_EXEC_TOKEN;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

// Extraer SUPABASE_REF desde NEXT_PUBLIC_SUPABASE_URL (https://{ref}.supabase.co)
function getSupabaseRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const host = new URL(url).hostname; // "tomlvgzwleolsxksiygs.supabase.co"
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

const POOLER_REGIONS = [
  "us-east-1",
  "us-west-1",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
];

async function tryConnect(): Promise<ReturnType<typeof postgres> | null> {
  const SUPABASE_REF = getSupabaseRef();
  if (!SUPABASE_REF || !SUPABASE_DB_PASSWORD) {
    console.error(
      "[exec-sql] Faltan env vars: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_DB_PASSWORD"
    );
    return null;
  }
  for (const region of POOLER_REGIONS) {
    for (const port of [5432, 6543]) {
      const host = `aws-0-${region}.pooler.supabase.com`;
      const url = `postgresql://postgres.${SUPABASE_REF}:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@${host}:${port}/postgres`;
      try {
        const sql = postgres(url, {
          max: 1,
          connect_timeout: 5,
          idle_timeout: 10,
          prepare: false,
        });
        // Test rápido
        await sql`SELECT 1 as ok`;
        console.log(`[exec-sql] conectado a ${host}:${port}`);
        return sql;
      } catch (e) {
        // Continuar probando
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!ADMIN_TOKEN) {
      console.error("[exec-sql] ADMIN_EXEC_TOKEN no configurado");
      return NextResponse.json(
        { error: "Endpoint no configurado" },
        { status: 503 }
      );
    }
    const token = req.headers.get("x-admin-token");
    if (token !== ADMIN_TOKEN) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { sql: sqlQuery } = await req.json();
    if (!sqlQuery || typeof sqlQuery !== "string") {
      return NextResponse.json({ error: "SQL requerido" }, { status: 400 });
    }

    const sql = await tryConnect();
    if (!sql) {
      return NextResponse.json(
        { error: "No se pudo conectar a ningún pooler de Supabase" },
        { status: 500 }
      );
    }

    try {
      const result = await sql.unsafe(sqlQuery);
      const rows = Array.isArray(result) ? result : [];
      return NextResponse.json({
        ok: true,
        rowCount: rows.length,
        rows: rows.slice(0, 50),
      });
    } finally {
      await sql.end();
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
