import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/emblems
 * Lista los emblemas activos ordenados por sort_order.
 * Público — el wizard de registro lo usa para el selector de escudo.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ emblems: [] }, { status: 200 });
  }
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("emblem")
    .select("id, name, image_url, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ emblems: [], error: error.message }, { status: 200 });
  }
  // Catálogo casi estático: cache agresiva en browser + edge. Si se agregan
  // emblemas, el stale-while-revalidate los propaga en segundos/minutos.
  return NextResponse.json({ emblems: data ?? [] }, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
