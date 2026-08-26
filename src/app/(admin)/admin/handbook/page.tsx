import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen, ExternalLink, FileText, Calendar, Info } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { getEditionForAdmin, signHandbookUrl } from "@/lib/edition";
import HandbookUploader from "./handbook-uploader";

export const dynamic = "force-dynamic";

export default async function AdminHandbookPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const params = await searchParams;
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const edition = await getEditionForAdmin(supabase, params.edition);
  const signedUrl = await signHandbookUrl(edition);
  const uploadedAt = edition?.handbook_uploaded_at;
  // El handbook puede ser un path de Storage (nuevo) o una URL http (datos viejos).
  const storagePath = edition?.handbook_url && !/^https?:\/\//i.test(edition.handbook_url)
    ? edition.handbook_url
    : null;

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="HANDBOOK"
        title="Reglamento del torneo"
        desc="El handbook es el PDF con el reglamento completo. Los equipos deben descargarlo obligatoriamente antes de aceptar los términos y completar la inscripción."
        stats={[
          { value: edition?.name ?? "—", label: "Edición" },
          { value: signedUrl ? "Disponible" : "Falta subir", label: "Estado", color: signedUrl ? "var(--vertigo-success)" : "#fbbf24" },
          {
            value: uploadedAt ? new Date(uploadedAt).toLocaleDateString("es-AR") : "—",
            label: "Subido",
          },
        ]}
      />

      <section className="mb-8">
        <div className="vertigo-subtitle">Handbook actual</div>
        <div className="vertigo-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className="flex items-center justify-center rounded-lg border border-[var(--vertigo-purple)] bg-[rgba(124,58,237,0.06)] text-[var(--vertigo-purple-soft)] flex-none"
              style={{ width: 56, height: 56 }}
            >
              <FileText style={{ width: 24, height: 24 }} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-cinzel text-base text-[var(--vertigo-text)]">
                vertigo-handbook.pdf
              </div>
              <div className="text-xs text-[var(--vertigo-muted)] mt-1 flex items-center gap-2 flex-wrap">
                {uploadedAt && (
                  <>
                    <Calendar style={{ width: 12, height: 12 }} />
                    <span>Subido {new Date(uploadedAt).toLocaleString("es-AR")}</span>
                  </>
                )}
                {!uploadedAt && <span>Versión por defecto (sin fecha de subida registrada)</span>}
                {storagePath && (
                  <span className="text-[var(--vertigo-faint)]">· storage: {storagePath}</span>
                )}
              </div>
            </div>
            {signedUrl ? (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="vertigo-btn vertigo-btn-primary flex-none"
              >
                <ExternalLink style={{ width: 14, height: 14 }} />
                Ver handbook
              </a>
            ) : (
              <span className="vertigo-badge vertigo-badge-warning flex-none">Sin PDF</span>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="vertigo-subtitle">Reemplazar handbook</div>
        <div className="vertigo-card">
          {edition ? (
            <HandbookUploader editionId={edition.id} />
          ) : (
            <div className="vertigo-empty">
              <BookOpen className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">Sin edición activa</div>
              <p className="vertigo-empty-desc">Creá una edición del torneo primero, desde la sección Torneo.</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="vertigo-subtitle">Nota importante</div>
        <div className="vertigo-card">
          <div className="flex items-start gap-3">
            <Info className="flex-none text-[var(--vertigo-purple-soft)] mt-0.5" style={{ width: 18, height: 18 }} />
            <div>
              <div className="vertigo-card-title">¿Quién maneja el handbook?</div>
              <p className="text-sm text-[var(--vertigo-muted)] mt-2 leading-relaxed">
                El handbook lo manejan los admins del torneo. No es editable desde la web — el contenido
                del PDF (reglas, formato, sanciones, schedules) se define offline y se sube como archivo final.
                El archivo vive en un bucket privado de Storage: a los equipos se les sirve con una URL
                firmada temporal generada al momento. Una vez subido, queda referenciado desde la edición
                y el wizard lo requiere como paso obligatorio antes de aceptar términos.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
