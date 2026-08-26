import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getEditionForAdmin } from "@/lib/edition";
import { uploadHandbookInternal } from "@/lib/handbook-upload";

/**
 * POST /api/admin/upload-handbook
 * Sube el handbook PDF al bucket privado 'handbook' de Supabase Storage.
 *
 * Body: multipart/form-data con 'file' (PDF) y 'edition_id' (opcional —
 * por defecto sube a la edición que el panel estaría gestionando).
 *
 * Requiere sesión admin autenticada (Supabase Auth + role admin/super_admin).
 * La vía principal es el uploader de /admin/handbook; este endpoint queda
 * para subidas programáticas (scripts, CI).
 */
export async function POST(req: NextRequest) {
  try {
    const account = await requireAdmin();
    if (!account) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const editionId = String(formData.get("edition_id") ?? "").trim();

    const supabase = (await getSupabaseServer()) as any;
    const edition = await getEditionForAdmin(supabase, editionId || null);
    if (!edition) {
      return NextResponse.json({ error: "No hay edición para subir el handbook." }, { status: 404 });
    }

    const res = await uploadHandbookInternal(edition.id, file as File);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, editionId: edition.id, path: res.path });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
