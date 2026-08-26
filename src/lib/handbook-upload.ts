/**
 * VÉRTIGO Cup — Subida del handbook PDF (compartida entre el server action
 * de /admin/handbook y el endpoint programático /api/admin/upload-handbook).
 *
 * Guarda en el bucket privado `handbook` con upsert y deja en la edición el
 * PATH de Storage (la URL firmada se genera al leer — ver signHandbookUrl).
 */
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { handbookStoragePath } from "@/lib/edition";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

export async function uploadHandbookInternal(
  editionId: string,
  file: File
): Promise<{ ok: boolean; error?: string; path?: string }> {
  if (!file || file.size === 0) return { ok: false, error: "Falta el archivo PDF." };
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: "El PDF supera los 20 MB." };
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { ok: false, error: "El handbook debe ser un PDF." };

  const service = getSupabaseServiceRole() as any;

  const { data: edition } = await service
    .from("tournament_edition")
    .select("id, slug")
    .eq("id", editionId)
    .maybeSingle();
  if (!edition) return { ok: false, error: "Edición no encontrada." };

  const path = handbookStoragePath(edition.slug);
  const { error: upErr } = await service.storage
    .from("handbook")
    .upload(path, file, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "3600",
    });
  if (upErr) return { ok: false, error: `Storage: ${upErr.message}` };

  const { error: dbErr } = await service
    .from("tournament_edition")
    .update({
      handbook_url: path,
      handbook_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", editionId);
  if (dbErr) return { ok: false, error: `DB: ${dbErr.message}` };

  return { ok: true, path };
}
