import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

/**
 * POST /api/admin/upload-handbook
 * Sube el handbook PDF al bucket 'handbook' de Supabase Storage.
 *
 * Body: multipart/form-data con 'file' (PDF)
 *
 * Requiere sesión admin autenticada (Supabase Auth + role admin/super_admin).
 */
export async function POST(req: NextRequest) {
  try {
    const account = await requireAdmin();
    if (!account) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "file requerido" }, { status: 400 });
    }

    const supabase = (await getSupabaseServer()) as any;

    const { data, error } = await supabase.storage
      .from("handbook")
      .upload("vertigo-handbook.pdf", file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      return NextResponse.json(
        { error: `Storage error: ${error.message}` },
        { status: 500 }
      );
    }

    const { data: signedUrlData, error: signedErr } = await supabase.storage
      .from("handbook")
      .createSignedUrl("vertigo-handbook.pdf", 3600 * 24 * 365);

    const { error: updateErr } = await supabase
      .from("tournament_edition")
      .update({
        handbook_url: signedUrlData?.signedUrl ?? null,
        handbook_uploaded_at: new Date().toISOString(),
      })
      .eq("slug", "vertigo-2026-1");

    return NextResponse.json({
      ok: true,
      path: data.path,
      signedUrl: signedUrlData?.signedUrl,
      updateError: updateErr?.message,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
