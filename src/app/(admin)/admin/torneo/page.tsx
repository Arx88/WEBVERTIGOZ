import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { getEditionForAdmin } from "@/lib/edition";
import {
  EditionConfigForm,
  EditionLifecycle,
  EditionCreateForm,
} from "./edition-forms";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  draft: "vertigo-badge-purple",
  registration: "vertigo-badge-warning",
  active: "vertigo-badge-danger",
  finished: "vertigo-badge-success",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  registration: "Inscripción abierta",
  active: "En curso",
  finished: "Finalizada",
};

export default async function AdminTorneoPage({
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

  // Todas las ediciones + conteo de equipos por edición (para el selector).
  const { data: editions } = (await supabase
    .from("tournament_edition")
    .select("id, slug, name, status, starts_at, created_at")
    .order("created_at", { ascending: false })) as { data: any };

  const { data: regs } = (await supabase
    .from("team_registration")
    .select("tournament_edition_id, status")) as { data: any };
  const teamsByEdition = new Map<string, { total: number; pending: number }>();
  for (const r of regs ?? []) {
    const acc = teamsByEdition.get(r.tournament_edition_id) ?? { total: 0, pending: 0 };
    acc.total += 1;
    if (r.status === "pending") acc.pending += 1;
    teamsByEdition.set(r.tournament_edition_id, acc);
  }

  // Edición seleccionada: ?edition= → la viva (registration/active) → la última.
  const edition = await getEditionForAdmin(supabase, params.edition);
  const editionId = edition?.id ?? null;

  let hasBracket = false;
  let unfinishedMatches = 0;
  if (editionId) {
    const { data: bracket } = (await supabase
      .from("bracket")
      .select("id")
      .eq("tournament_edition_id", editionId)
      .limit(1)
      .maybeSingle()) as { data: any };
    hasBracket = Boolean(bracket);

    if (hasBracket) {
      const { data: brackets } = (await supabase
        .from("bracket")
        .select("id")
        .eq("tournament_edition_id", editionId)) as { data: any };
      const bracketIds = (brackets ?? []).map((b: any) => b.id);
      if (bracketIds.length > 0) {
        const { data: rounds } = (await supabase
          .from("round")
          .select("id")
          .in("bracket_id", bracketIds)) as { data: any };
        const roundIds = (rounds ?? []).map((r: any) => r.id);
        if (roundIds.length > 0) {
          const { count } = (await supabase
            .from("match")
            .select("id", { count: "exact", head: true })
            .in("round_id", roundIds)
            .not("status", "in", "(finished,forfeit,cancelled)")) as { count: number | null };
          unfinishedMatches = count ?? 0;
        }
      }
    }
  }

  const editionTeams = editionId ? teamsByEdition.get(editionId) : null;

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="TORNEO"
        title="Configuración de la edición"
        desc="Creá ediciones, configurá sus parámetros y manejá el ciclo de vida completo: inscripciones, torneo en curso y cierre."
        stats={[
          { value: edition?.name ?? "—", label: "Edición" },
          { value: edition ? STATUS_LABEL[edition.status] ?? edition.status : "—", label: "Status" },
          { value: `${editionTeams?.total ?? 0} / ${edition?.max_teams ?? 32}`, label: "Equipos" },
          {
            value: editionTeams?.pending ?? 0,
            label: "Pendientes",
            color: (editionTeams?.pending ?? 0) > 0 ? "#fbbf24" : undefined,
          },
        ]}
      />

      {/* Selector de ediciones */}
      <section className="mb-10">
        <div className="vertigo-subtitle">Ediciones</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(editions ?? []).map((e: any) => {
            const selected = e.id === editionId;
            const t = teamsByEdition.get(e.id);
            return (
              <Link
                key={e.id}
                href={`/admin/torneo?edition=${e.id}`}
                className="vertigo-info-card block"
                style={selected ? { borderColor: "var(--vertigo-gold, #d4af37)", boxShadow: "0 0 0 1px var(--vertigo-gold, #d4af37)" } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="vertigo-info-card-value text-base truncate">{e.name}</div>
                  <span className={`vertigo-badge ${STATUS_BADGE[e.status] ?? "vertigo-badge-purple"} flex-none`}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                <div className="text-xs text-[var(--vertigo-muted)] mt-2">
                  {t?.total ?? 0} equipo{(t?.total ?? 0) === 1 ? "" : "s"}
                  {(t?.pending ?? 0) > 0 && ` · ${t?.pending} pendiente${t?.pending === 1 ? "" : "s"}`}
                  {" · "}
                  {new Date(e.created_at).toLocaleDateString("es-AR")}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {!edition ? (
        <section className="mb-10">
          <div className="vertigo-subtitle">Crear la primera edición</div>
          <EditionCreateForm defaults={null} />
        </section>
      ) : (
        <>
          {/* Ciclo de vida */}
          <section className="mb-10">
            <div className="vertigo-subtitle">Ciclo de vida</div>
            <EditionLifecycle
              editionId={edition.id}
              status={edition.status}
              unfinishedMatches={unfinishedMatches}
            />
          </section>

          {/* Configuración */}
          <section className="mb-10">
            <div className="vertigo-subtitle">Configuración de «{edition.name}»</div>
            <EditionConfigForm edition={edition} hasBracket={hasBracket} />
          </section>
        </>
      )}

      {/* Nueva edición (si no hay ninguna, el formulario de arriba ya es el de crear) */}
      {edition && (
        <section id="nueva-edicion" className="mb-10">
          <div className="flex items-center gap-2">
            <Plus style={{ width: 16, height: 16, color: "var(--vertigo-purple-soft)" }} />
            <div className="vertigo-subtitle mb-0">Nueva edición</div>
          </div>
          <p className="vertigo-desc" style={{ marginTop: 6 }}>
            Cerraste el torneo actual y querés abrir otro con nueva configuración:
            crealo acá. Cuando la dejes lista, usá «Abrir inscripciones» en el ciclo de vida.
          </p>
          <div className="h-4" />
          <EditionCreateForm defaults={(editions ?? [])[0] ?? null} />
        </section>
      )}
    </div>
  );
}
