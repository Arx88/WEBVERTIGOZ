import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { getEditionForAdmin } from "@/lib/edition";
import {
  EditionConfigForm,
  EditionLifecycle,
  EditionCreateForm,
} from "./edition-forms";
import { fmt } from "@/lib/format";

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
    .select("id, slug, name, status, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false })) as { data: any };

  // Plantillas para el wizard de creación: config completa de ediciones cerradas.
  const { data: templates } = (await supabase
    .from("tournament_edition")
    .select("*")
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(5)) as { data: any };

  // Invariante: un solo torneo vivo. Mientras haya una edición no finalizada
  // (y su fecha de fin no haya pasado), no se puede crear otra.
  const liveEdition = (editions ?? []).find(
    (e: any) => e.status !== "finished"
  ) as any;
  const liveEnded = liveEdition?.ends_at
    ? new Date(liveEdition.ends_at).getTime() < Date.now()
    : false;
  const createBlocked = Boolean(liveEdition && !liveEnded);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(editions ?? []).map((e: any) => {
            const selected = e.id === editionId;
            const t = teamsByEdition.get(e.id);
            const isLive = e.status === "registration" || e.status === "active";
            return (
              <Link
                key={e.id}
                href={`/admin/torneo?edition=${e.id}`}
                className={`vertigo-info-card block transition-all ${
                  selected
                    ? "border-[rgba(212,175,55,0.7)] bg-[rgba(212,175,55,0.05)] shadow-[0_0_28px_rgba(212,175,55,0.14)]"
                    : "hover:border-[#3a3049]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isLive && (
                        <span
                          className={`h-2 w-2 flex-none animate-pulse rounded-full ${
                            e.status === "registration" ? "bg-[#fbbf24]" : "bg-[var(--vertigo-danger)]"
                          }`}
                        />
                      )}
                      <div className="text-[15px] font-semibold leading-snug text-[var(--vertigo-text)]">{e.name}</div>
                    </div>
                    {selected && (
                      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[2px] text-[#D4AF37]">
                        En pantalla ↓
                      </div>
                    )}
                  </div>
                  <span className={`vertigo-badge ${STATUS_BADGE[e.status] ?? "vertigo-badge-purple"} flex-none`}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                <div className="mt-2.5 text-xs text-[var(--vertigo-muted)]">
                  {t?.total ?? 0} equipo{(t?.total ?? 0) === 1 ? "" : "s"}
                  {(t?.pending ?? 0) > 0 && ` · ${t?.pending} pendiente${t?.pending === 1 ? "" : "s"}`}
                  {" · "}
                  {fmt.date(e.created_at)}
                </div>
              </Link>
            );
          })}
          {/* Acceso rápido a nueva edición */}
          <Link
            href="#nueva-edicion"
            className="vertigo-info-card flex items-center justify-center gap-2 border-dashed text-[var(--vertigo-muted)] transition-colors hover:border-[var(--vertigo-purple)] hover:text-[var(--vertigo-text)]"
            style={{ minHeight: 84 }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            <span className="text-sm">Nueva edición</span>
          </Link>
        </div>
      </section>

      {!edition ? (
        <section className="mb-10">
          <div className="vertigo-subtitle">Crear la primera edición</div>
          <EditionCreateForm templates={templates ?? []} />
        </section>
      ) : (
        <>
          {/* Ciclo de vida */}
          <section id="ciclo-vida" className="mb-10 scroll-mt-24">
            <div className="vertigo-subtitle">Ciclo de vida</div>
            <EditionLifecycle
              editionId={edition.id}
              status={edition.status}
              unfinishedMatches={unfinishedMatches}
              edition={edition}
              hasBracket={hasBracket}
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
        <section id="nueva-edicion" className="mb-10 scroll-mt-24">
          <div className="flex items-center gap-2">
            <Plus style={{ width: 16, height: 16, color: "var(--vertigo-purple-soft)" }} />
            <div className="vertigo-subtitle mb-0">Nueva edición</div>
          </div>
          {createBlocked ? (
            <div
              className="mt-4 flex flex-col gap-4 rounded-xl border border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.05)] p-5 sm:flex-row sm:items-center"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[rgba(251,191,36,0.5)] bg-[rgba(251,191,36,0.1)]">
                <Lock className="h-4.5 w-4.5 text-[#fbbf24]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--vertigo-text)]">
                  Hay un torneo vivo: «{liveEdition.name}»
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--vertigo-muted)]">
                  Solo puede existir un torneo a la vez. Para crear una edición nueva,
                  primero finalizá la actual desde el ciclo de vida
                  {liveEdition.ends_at && (
                    <> (o esperá a que pase su fecha de fin: {fmt.date(liveEdition.ends_at)})</>
                  )}
                  .
                </p>
              </div>
              <a href="#ciclo-vida" className="vertigo-btn flex-none">
                Ir al ciclo de vida
              </a>
            </div>
          ) : (
            <>
              <p className="vertigo-desc" style={{ marginTop: 6 }}>
                Cerraste el torneo actual y querés abrir otro: crealo acá en 3 pasos,
                arrancando de cero o reciclando la configuración de un torneo anterior.
              </p>
              <div className="h-4" />
              <EditionCreateForm templates={templates ?? []} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
