import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { assertDevEndpointAllowed } from "@/lib/auth/dev-endpoint-guard";

/**
 * POST /api/admin/exec-sql
 * Endpoint TEMPORAL de DESARROLLO para ejecutar SQL en Supabase (útil para migraciones).
 *
 * SEGURIDAD:
 *  - En producción (NODE_ENV === "production") o sin ADMIN_EXEC_TOKEN seteado,
 *    responde 404 como si la ruta no existiera (ver assertDevEndpointAllowed).
 *  - En dev, además del guard, exige el header x-admin-token correcto (doble check,
 *    defensa en profundidad), con comparación de longitud constante contra el env var.
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

// Los proyectos nuevos de Supabase usan pooler "aws-1" en vez de "aws-0"
// y pueden vivir en regiones fuera de la lista histórica.
const EXTRA_POOLER_HOSTS = ["aws-1-eu-west-1", "aws-1-us-east-1"];

async function tryConnect(): Promise<ReturnType<typeof postgres> | null> {
  const SUPABASE_REF = getSupabaseRef();
  if (!SUPABASE_REF || !SUPABASE_DB_PASSWORD) {
    console.error(
      "[exec-sql] Faltan env vars: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_DB_PASSWORD"
    );
    return null;
  }
  const hosts = [
    ...EXTRA_POOLER_HOSTS,
    ...POOLER_REGIONS.map((region) => `aws-0-${region}`),
  ];
  for (const hostBase of hosts) {
    for (const port of [5432, 6543]) {
      const host = `${hostBase}.pooler.supabase.com`;
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
  // PRIMERA LÍNEA DE DEFENSA: este endpoint no existe en producción ni sin
  // ADMIN_EXEC_TOKEN configurado. 404 genérico para no revelar su existencia.
  const blocked = assertDevEndpointAllowed();
  if (blocked) return blocked;

  try {
    // SEGUNDA LÍNEA DE DEFENSA (defensa en profundidad): el guard ya garantiza
    // que ADMIN_EXEC_TOKEN existe; acá validamos el header igual que antes.
    const token = req.headers.get("x-admin-token");
    if (!token || token !== ADMIN_TOKEN) {
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
