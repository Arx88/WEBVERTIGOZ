import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/health
 * Verifica que la conexión a Supabase funcione.
 */
export async function GET() {
  const checks: { name: string; ok: boolean; detail?: string }[] = [];

  const requiredEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
  ];
  for (const k of requiredEnv) {
    checks.push({
      name: `env:${k}`,
      ok: !!process.env[k],
      detail: process.env[k] ? "configurada" : "FALTA",
    });
  }

  try {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.getSession();
    checks.push({
      name: "supabase:auth",
      ok: !error,
      detail: error ? error.message : "ok",
    });
  } catch (e) {
    checks.push({
      name: "supabase:auth",
      ok: false,
      detail: e instanceof Error ? e.message : "error desconocido",
    });
  }

  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("tournament_edition")
      .select("slug, name, status")
      .limit(1);
    checks.push({
      name: "supabase:db:tournament_edition",
      ok: !error,
      detail: error ? error.message : `${data?.length ?? 0} registros`,
    });
  } catch (e) {
    checks.push({
      name: "supabase:db:tournament_edition",
      ok: false,
      detail: e instanceof Error ? e.message : "error desconocido",
    });
  }

  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("emblem")
      .select("name, category")
      .limit(1);
    checks.push({
      name: "supabase:db:emblem",
      ok: !error,
      detail: error ? error.message : `${data?.length ?? 0} emblemas`,
    });
  } catch (e) {
    checks.push({
      name: "supabase:db:emblem",
      ok: false,
      detail: e instanceof Error ? e.message : "error desconocido",
    });
  }

  const allOk = checks.every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "error",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 500 }
  );
}
