import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScrollText, Download, Shield, Hash, ChevronDown } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTER_BADGE: Record<string, string> = {
  all: "vertigo-badge-purple",
  commit: "vertigo-badge-purple",
  spin_start: "vertigo-badge-warning",
  spin_end: "vertigo-badge-warning",
  reveal: "vertigo-badge-success",
  publish: "vertigo-badge-success",
  cancel: "vertigo-badge-danger",
};

const FILTER_LABEL: Record<string, string> = {
  all: "Todos",
  commit: "Commit",
  spin_start: "Spin start",
  spin_end: "Spin end",
  reveal: "Reveal",
  publish: "Publish",
  cancel: "Cancel",
};

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const params = await searchParams;
  const filter = params.filter ?? "all";

  let query = supabase
    .from("draw_audit_log")
    .select(`
      id, event_type, hash_chain, previous_hash, payload, created_at,
      draw:draw_id (commit_hash, revealed_seed, status ),
      actor:actor_account_id (display_name, email)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter !== "all") {
    query = query.eq("event_type", filter);
  }

  const { data: logs } = (await query) as { data: any };

  const { count: total } = (await supabase
    .from("draw_audit_log")
    .select("id", { count: "exact", head: true })) as { count: number | null };

  const stats = {
    commits: logs?.filter((l: any) => l.event_type === "commit").length ?? 0,
    reveals: logs?.filter((l: any) => l.event_type === "reveal").length ?? 0,
    publishes: logs?.filter((l: any) => l.event_type === "publish").length ?? 0,
    cancels: logs?.filter((l: any) => l.event_type === "cancel").length ?? 0,
  };

  const csvHref = "#";

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="AUDITORÍA"
        title="Logs inmutables"
        desc="Verificación criptográfica de cada sorteo. Hash commit-reveal SHA-256. Log append-only con hash encadenado."
        stats={[
          { value: total ?? 0, label: "Eventos totales" },
          { value: stats.commits, label: "Commits", color: "var(--vertigo-purple-pale)" },
          { value: stats.reveals, label: "Reveals", color: "var(--vertigo-success)" },
          { value: stats.cancels, label: "Cancels", color: "var(--vertigo-danger)" },
        ]}
      />

      <section className="mb-8">
        <div className="vertigo-subtitle">Filtros</div>
        <div className="vertigo-action-bar">
          {Object.entries(FILTER_LABEL).map(([key, label]) => (
            <a
              key={key}
              href={key === "all" ? "/admin/auditoria" : `/admin/auditoria?filter=${key}`}
              className={`vertigo-badge ${filter === key ? "vertigo-badge-success" : FILTER_BADGE[key] ?? "vertigo-badge-purple"}`}
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="vertigo-subtitle">Exportar</div>
        <div className="vertigo-action-bar">
          <a href={csvHref} className="vertigo-btn vertigo-btn-ghost">
            <Download style={{ width: 14, height: 14 }} />
            Export CSV
          </a>
        </div>
      </section>

      <section>
        <div className="vertigo-subtitle">
          Eventos
          <span className="vertigo-badge vertigo-badge-purple ml-2">{logs?.length ?? 0}</span>
        </div>
        {(!logs || logs.length === 0) ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <ScrollText className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">Sin eventos</div>
              <p className="vertigo-empty-desc">
                El sistema de auditoría de sorteos estará disponible cuando se generen los primeros sorteos (Fase 2 V1).
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {logs.map((log: any) => (
              <div key={log.id} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`vertigo-badge ${FILTER_BADGE[log.event_type] ?? "vertigo-badge-purple"} flex-none`}>
                      {FILTER_LABEL[log.event_type] ?? log.event_type}
                    </span>
                    <div className="min-w-0">
                      <div className="font-cinzel text-sm text-[var(--vertigo-text)] truncate">
                        {log.draw?.commit_hash?.slice(0, 16) ?? "—"}…
                      </div>
                      <div className="text-[11px] text-[var(--vertigo-faint)] mt-0.5">
                        {log.actor?.display_name ?? log.actor?.email ?? "—"} ·{" "}
                        {fmt.dateTime(log.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-none">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] flex items-center justify-end gap-1">
                      <Hash style={{ width: 10, height: 10 }} />
                      Hash chain
                    </div>
                    <div className="font-mono text-xs text-[var(--vertigo-purple-soft)]">
                      {log.hash_chain?.slice(0, 16) ?? "—"}…
                    </div>
                  </div>
                </div>

                {log.previous_hash && (
                  <div className="mb-2 text-[11px] text-[var(--vertigo-faint)]">
                    Previous: <span className="font-mono text-[var(--vertigo-muted)]">{log.previous_hash.slice(0, 24)}…</span>
                  </div>
                )}

                {log.payload && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[var(--vertigo-purple-soft)] flex items-center gap-1 hover:text-[var(--vertigo-purple-pale)]">
                      <ChevronDown style={{ width: 12, height: 12 }} />
                      Payload
                    </summary>
                    <pre className="mt-2 p-3 bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-line-soft)] rounded-md text-[11px] text-[var(--vertigo-muted)] overflow-x-auto font-mono">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="vertigo-card mt-8">
        <div className="flex items-start gap-3">
          <Shield className="flex-none text-[var(--vertigo-purple-soft)] mt-0.5" style={{ width: 18, height: 18 }} />
          <div>
            <div className="vertigo-card-title">Garantía criptográfica</div>
            <p className="text-sm text-[var(--vertigo-muted)] mt-2 leading-relaxed">
              Cada sorteo se compromete con un hash SHA-256 antes de girar la ruleta.
              El admin revela el seed original después del spin, permitiendo a cualquier tercero verificar
              que el resultado no fue manipulado. La cadena de hashes garantiza que ningún log puede
              modificarse retroactivamente sin romper la cadena.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
