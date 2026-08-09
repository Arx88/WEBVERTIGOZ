import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen, ExternalLink, FileText, Calendar, Info } from "lucide-react";

export const dynamic = "force-dynamic";

const DEFAULT_HANDBOOK_URL = "https://tomlvgzwleolsxksiygs.supabase.co/storage/v1/object/public/handbook/vertigo-handbook.pdf";

export default async function AdminHandbookPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name, handbook_url, handbook_uploaded_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };

  const handbookUrl = edition?.handbook_url ?? DEFAULT_HANDBOOK_URL;
  const uploadedAt = edition?.handbook_uploaded_at;
  const hasHandbook = Boolean(edition?.handbook_url || DEFAULT_HANDBOOK_URL);

  return (
    <div className="vertigo-fade-in">
      <span className="vertigo-kicker">HANDBOOK</span>
      <h1 className="vertigo-title">Reglamento del torneo</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">
        El handbook es el PDF con el reglamento completo. Los equipos deben descargarlo obligatoriamente
        antes de aceptar los términos y completar la inscripción.
      </p>

      <div className="vertigo-stats">
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Edición</div>
          <div className="vertigo-stat-value text-base">{edition?.name ?? "—"}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Estado</div>
          <div className="vertigo-stat-value text-base">
            {hasHandbook ? "Disponible" : "Falta subir"}
          </div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Subido</div>
          <div className="vertigo-stat-value text-base">
            {uploadedAt ? new Date(uploadedAt).toLocaleDateString("es-AR") : "—"}
          </div>
        </div>
      </div>

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
              </div>
            </div>
            <a
              href={handbookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="vertigo-btn vertigo-btn-primary flex-none"
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
              Ver handbook
            </a>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="vertigo-subtitle">Reemplazar handbook</div>
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <BookOpen className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
            <div className="vertigo-empty-title">Uploader en desarrollo</div>
            <p className="vertigo-empty-desc">
              Para subir un nuevo handbook, usá el endpoint <code className="text-[var(--vertigo-purple-pale)]">/api/admin/upload-handbook</code>
              {" "}con un PDF. El uploader visual estará disponible próximamente.
            </p>
          </div>
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
                Una vez subido, queda referenciado desde la edición activa y el wizard lo requiere como paso
                obligatorio antes de aceptar términos.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
