import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveDisputeAction } from "@/server/actions/auth";
import { AlertTriangle, Shield, Clock, Image as ImageIcon, ExternalLink } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import VertigoSelect from "@/components/admin/vertigo-select";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { cls: string; dot: string; label: string }> = {
  open: { cls: "vertigo-badge-danger", dot: "var(--vertigo-danger)", label: "Abierta" },
  reviewing: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "En revisión" },
  resolved: { cls: "vertigo-badge-success", dot: "var(--vertigo-success)", label: "Resuelta" },
  rejected: { cls: "vertigo-badge-purple", dot: "var(--vertigo-faint)", label: "Rechazada" },
};

export default async function AdminDisputasPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: disputes } = (await supabase
    .from("dispute")
    .select(`
      id, reason, evidence_urls, status, resolution_notes, resolved_at, created_at,
      match:match_id (id, status, scheduled_at_start, round:round_id (name),
        team_a:team_a_id (id, team_account:team_account_id (name)),
        team_b:team_b_id (id, team_account:team_account_id (name))
      ),
      raised_by_team:raised_by_team_id (id, team_account:team_account_id (name))
    `)
    .order("created_at", { ascending: false })) as { data: any };

  const total = disputes?.length ?? 0;
  const open = disputes?.filter((d: any) => d.status === "open").length ?? 0;
  const reviewing = disputes?.filter((d: any) => d.status === "reviewing").length ?? 0;
  const resolved = disputes?.filter((d: any) => d.status === "resolved").length ?? 0;

  const isSuperAdmin = account.role === "super_admin";

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="DISPUTAS"
        title="Resolución de disputas"
        desc="Reclamos de capitanes sobre partidos. Ventana de 30 min post-finalizado. Revisar screenshots y aplicar decisión. Solo super_admin puede resolver."
        stats={[
          { value: open, label: "Abiertas", color: "var(--vertigo-danger)" },
          { value: reviewing, label: "En revisión", color: "#fbbf24" },
          { value: resolved, label: "Resueltas", color: "var(--vertigo-success)" },
          { value: total, label: "Total" },
        ]}
      />

      {total === 0 ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <AlertTriangle className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
            <div className="vertigo-empty-title">Sin disputas</div>
            <p className="vertigo-empty-desc">
              No hay reclamos activos. Cuando un capitán abra una disputa desde su panel,
              aparecerá acá para que la revises.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {disputes.map((d: any) => {
            const meta = STATUS_META[d.status] ?? STATUS_META.open;
            const match = d.match;
            const teamAName = match?.team_a?.team_account?.name ?? "Equipo A";
            const teamBName = match?.team_b?.team_account?.name ?? "Equipo B";
            return (
              <div key={d.id} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`vertigo-badge ${meta.cls} flex-none`}>
                      <span className="vertigo-status-dot" style={{ background: meta.dot }} />
                      {meta.label}
                    </span>
                    <div className="min-w-0">
                      <div className="font-cinzel text-sm text-[var(--vertigo-text)] truncate">
                        {match?.round?.name ?? "Ronda"} · {teamAName} vs {teamBName}
                      </div>
                      <div className="text-[11px] text-[var(--vertigo-faint)] mt-0.5 flex items-center gap-2">
                        <Clock style={{ width: 11, height: 11 }} />
                        Abierta {fmt.dateTime(d.created_at)}
                        {" · "}
                        Por: {d.raised_by_team?.team_account?.name ?? "—"}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`/admin/partido/${match?.id ?? "#"}`}
                    className="vertigo-btn vertigo-btn-ghost flex-none"
                  >
                    <ExternalLink style={{ width: 12, height: 12 }} />
                    Ver partido
                  </a>
                </div>

                <div className="vertigo-subtitle">Descripción del reclamo</div>
                <p className="text-sm text-[var(--vertigo-text)] leading-relaxed mb-4">
                  {d.reason}
                </p>

                {Array.isArray(d.evidence_urls) && d.evidence_urls.length > 0 && (
                  <>
                    <div className="vertigo-subtitle">Evidencias</div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {d.evidence_urls.map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vertigo-badge vertigo-badge-purple hover:opacity-80"
                        >
                          <ImageIcon style={{ width: 12, height: 12 }} />
                          Evidencia {i + 1}
                          <ExternalLink style={{ width: 10, height: 10 }} />
                        </a>
                      ))}
                    </div>
                  </>
                )}

                {d.resolution_notes && (
                  <>
                    <div className="vertigo-subtitle">Resolución anterior</div>
                    <p className="text-sm text-[var(--vertigo-muted)] leading-relaxed mb-4">
                      {d.resolution_notes}
                    </p>
                  </>
                )}

                {(d.status === "open" || d.status === "reviewing") && (
                  <>
                    <div className="vertigo-subtitle">Resolver disputa</div>
                    {!isSuperAdmin ? (
                      <div className="vertigo-card bg-[rgba(251,113,133,0.04)]">
                        <div className="flex items-start gap-3">
                          <Shield className="flex-none text-[var(--vertigo-danger)] mt-0.5" style={{ width: 16, height: 16 }} />
                          <p className="text-sm text-[var(--vertigo-muted)]">
                            Solo super_admin puede resolver disputas. Contactá a uno para continuar.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <form action={resolveDisputeAction} className="flex flex-col gap-4">
                        <input type="hidden" name="dispute_id" value={d.id} />
                        <div className="vertigo-field">
                          <label>Notas de resolución</label>
                          <textarea
                            name="resolution_notes"
                            placeholder="Explicá la decisión, las evidencias consideradas y el resultado aplicado…"
                            rows={3}
                            className="!h-auto !py-3"
                          />
                        </div>
                        <div className="vertigo-field">
                          <label>Veredicto</label>
                          <VertigoSelect
                            name="verdict"
                            defaultValue="resolved"
                            options={[
                              { value: "resolved", label: "Resolver a favor (aplicar resultado)" },
                              { value: "rejected", label: "Rechazar (mantener resultado original)" },
                            ]}
                          />
                        </div>
                        <div className="vertigo-action-bar">
                          <button type="submit" className="vertigo-btn vertigo-btn-success">
                            <Shield style={{ width: 14, height: 14 }} />
                            Aplicar resolución
                          </button>
                          <button
                            type="submit"
                            name="verdict"
                            value="rejected"
                            className="vertigo-btn vertigo-btn-danger"
                          >
                            <AlertTriangle style={{ width: 14, height: 14 }} />
                            Rechazar disputa
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
