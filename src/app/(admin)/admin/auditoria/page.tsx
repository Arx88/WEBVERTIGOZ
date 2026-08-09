import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import Link from "next/link";
import { LogOut, Search, CheckCircle, XCircle, Eye, Download } from "lucide-react";

export const dynamic = "force-dynamic";

interface AuditLogRow {
  id: string;
  draw_id: string | null;
  event_type: string;
  hash_chain: string;
  previous_hash: string | null;
  payload: any;
  created_at: string;
  actor?: { display_name: string };
}

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; limit?: string }>;
}) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) {
    redirect("/mi-equipo");
  }

  const params = await searchParams;
  const eventTypeFilter = params.type;
  const limit = Math.min(parseInt(params.limit ?? "100", 10), 500);

  // Query audit logs
  let query = supabase
    .from("draw_audit_log")
    .select(`
      id, draw_id, event_type, hash_chain, previous_hash, payload, created_at,
      actor:actor_account_id (display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventTypeFilter) {
    query = query.eq("event_type", eventTypeFilter);
  }

  const { data: logs } = (await query) as { data: AuditLogRow[] };

  const allLogs = logs ?? [];
  const stats = {
    total: allLogs.length,
    commits: allLogs.filter((l) => l.event_type === "commit").length,
    spinSteps: allLogs.filter((l) => l.event_type === "spin_step").length,
    publishes: allLogs.filter((l) => l.event_type === "publish").length,
    reveals: allLogs.filter((l) => l.event_type === "reveal").length,
    cancels: allLogs.filter((l) => l.event_type === "cancel").length,
  };

  // Verificar integridad del hashChain (previous_hash encadena correctamente)
  const logsReversed = [...allLogs].reverse(); // orden cronológico
  let prevHash: string | null = null;
  const integrityMap: Record<string, boolean> = {};

  for (const log of logsReversed) {
    const prevHashMatches = log.previous_hash === prevHash;
    integrityMap[log.id] = prevHashMatches;
    prevHash = log.hash_chain;
  }

  // Draws info
  const drawIds = [...new Set(allLogs.map((l) => l.draw_id).filter(Boolean))] as string[];
  let drawsMap: Record<string, any> = {};
  if (drawIds.length > 0) {
    const { data: rDraws } = (await supabase
      .from("roulette_draw")
      .select("id, status, commit_hash, revealed_seed, match_game_id")
      .in("id", drawIds)) as { data: any[] };
    rDraws?.forEach((d) => { drawsMap[d.id] = { ...d, type: "match" }; });

    const missingIds = drawIds.filter((id) => !drawsMap[id]);
    if (missingIds.length > 0) {
      const { data: sDraws } = (await supabase
        .from("seeding_draw")
        .select("id, status, commit_hash, revealed_seed, bracket_id")
        .in("id", missingIds)) as { data: any[] };
      sDraws?.forEach((d) => { drawsMap[d.id] = { ...d, type: "seeding" }; });
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <span className="vertigo-kicker">AUDITORÍA</span>
          <h1 className="vertigo-title">Logs inmutables</h1>
        </div>
        <form action={logoutAction} style={{ display: "inline" }}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost">
            <LogOut size={14} style={{ display: "inline", marginRight: "6px" }} />
            Salir
          </button>
        </form>
      </div>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      <p className="vertigo-desc" style={{ marginBottom: "24px" }}>
        Verificación criptográfica de cada sorteo. Hash commit-reveal SHA-256. Log append-only con hash encadenado.
      </p>

      {/* Stats */}
      <div className="vertigo-stats" style={{ marginBottom: "24px" }}>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">TOTAL EVENTOS</div>
          <div className="vertigo-stat-value">{stats.total}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">COMMITS</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-purple-soft)" }}>{stats.commits}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">SPIN STEPS</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-warning)" }}>{stats.spinSteps}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">PUBLISHES</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-success)" }}>{stats.publishes}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">REVEALS</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-success)" }}>{stats.reveals}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">CANCELS</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-danger)" }}>{stats.cancels}</div>
        </div>
      </div>

      {/* Filtros */}
      <section style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <Search size={14} style={{ color: "var(--vertigo-muted)" }} />
          <span style={{ fontSize: "12px", color: "var(--vertigo-muted)", marginRight: "8px" }}>Filtrar:</span>
          <FilterLink href="/admin/auditoria" active={!eventTypeFilter} label="Todos" />
          <FilterLink href="/admin/auditoria?type=commit" active={eventTypeFilter === "commit"} label="Commits" />
          <FilterLink href="/admin/auditoria?type=spin_step" active={eventTypeFilter === "spin_step"} label="Spin Steps" />
          <FilterLink href="/admin/auditoria?type=publish" active={eventTypeFilter === "publish"} label="Publishes" />
          <FilterLink href="/admin/auditoria?type=reveal" active={eventTypeFilter === "reveal"} label="Reveals" />
          <FilterLink href="/admin/auditoria?type=cancel" active={eventTypeFilter === "cancel"} label="Cancels" />
        </div>
      </section>

      {/* Lista de logs */}
      <section>
        {allLogs.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <div className="vertigo-empty-title">Sin eventos de auditoría</div>
              <p className="vertigo-empty-desc">
                Los eventos aparecerán cuando se realice el primer sorteo (commit, spin, publish, reveal).
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {allLogs.map((log) => {
              const draw = log.draw_id ? drawsMap[log.draw_id] : null;
              const integrityOk = integrityMap[log.id];

              const eventColors: Record<string, string> = {
                commit: "#7c3aed",
                spin_step: "#fbbf24",
                spin_complete: "#a78bfa",
                publish: "#22c55e",
                reveal: "#22c55e",
                cancel: "#ef4444",
              };
              const color = eventColors[log.event_type] ?? "#6b7280";

              return (
                <div
                  key={log.id}
                  style={{
                    padding: "12px 16px",
                    background: "var(--vertigo-panel)",
                    borderRadius: "10px",
                    border: `1px solid ${color}33`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        padding: "3px 8px",
                        background: `${color}22`,
                        color: color,
                        borderRadius: "999px",
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                      }}>
                        {log.event_type}
                      </span>
                      {log.actor?.display_name && (
                        <span style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                          por {log.actor.display_name}
                        </span>
                      )}
                      <span style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                        {new Date(log.created_at).toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {integrityOk ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--vertigo-success)" }}>
                          <CheckCircle size={12} /> Chain OK
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--vertigo-danger)" }}>
                          <XCircle size={12} /> Chain broken
                        </span>
                      )}
                      {draw && (
                        <Link href={`/sorteos/${log.draw_id}/verificar`} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--vertigo-purple-soft)", textDecoration: "none" }}>
                          <Eye size={12} /> Verificar
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Hash chain */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10px", fontFamily: "monospace", color: "var(--vertigo-muted)", marginBottom: "8px" }}>
                    <div>
                      <div style={{ opacity: 0.6 }}>hash_chain:</div>
                      <div style={{ color: "var(--vertigo-text)", wordBreak: "break-all", fontSize: "10px" }}>
                        {log.hash_chain?.slice(0, 32)}...
                      </div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6 }}>previous_hash:</div>
                      <div style={{ color: "var(--vertigo-text)", wordBreak: "break-all", fontSize: "10px" }}>
                        {log.previous_hash ? `${log.previous_hash.slice(0, 32)}...` : "(genesis — null)"}
                      </div>
                    </div>
                  </div>

                  {/* Draw info */}
                  {draw && (
                    <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "8px" }}>
                      Sorteo: <code style={{ color: "var(--vertigo-purple-soft)" }}>{log.draw_id?.slice(0, 8)}</code>
                      {" · "} Tipo: {draw.type === "seeding" ? "Bracket seeding" : "Partida"}
                      {" · "} Status: <strong style={{ color: "var(--vertigo-text)" }}>{draw.status}</strong>
                      {draw.revealed_seed && (
                        <>
                          {" · "} <span style={{ color: "var(--vertigo-success)" }}>Revelado ✓</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Payload */}
                  {log.payload && Object.keys(log.payload).length > 0 && (
                    <details style={{ fontSize: "11px" }}>
                      <summary style={{ cursor: "pointer", color: "var(--vertigo-muted)", fontSize: "11px" }}>
                        Payload ({Object.keys(log.payload).length} keys)
                      </summary>
                      <pre style={{
                        marginTop: "8px",
                        padding: "8px",
                        background: "var(--vertigo-bg)",
                        borderRadius: "6px",
                        fontSize: "10px",
                        color: "var(--vertigo-text)",
                        overflow: "auto",
                        fontFamily: "monospace",
                      }}>
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Export CSV */}
        {allLogs.length > 0 && (
          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <button
              type="button"
              className="vertigo-btn vertigo-btn-ghost"
              onClick={() => (window as any).exportCsv(allLogs)}
              style={{ fontSize: "12px" }}
            >
              <Download size={12} style={{ display: "inline", marginRight: "4px" }} />
              Exportar CSV ({allLogs.length} eventos)
            </button>
          </div>
        )}
      </section>

      <script dangerouslySetInnerHTML={{ __html: `
        function exportCsv(logs) {
          const headers = ['created_at', 'event_type', 'draw_id', 'actor', 'hash_chain', 'previous_hash', 'payload'];
          const rows = logs.map(l => [
            l.created_at,
            l.event_type,
            l.draw_id || '',
            l.actor?.display_name || '',
            l.hash_chain || '',
            l.previous_hash || '',
            JSON.stringify(l.payload || {}),
          ]);
          const csv = [headers, ...rows]
            .map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(','))
            .join('\\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'vertigo-audit-' + new Date().toISOString().slice(0, 10) + '.csv';
          a.click();
          URL.revokeObjectURL(url);
        }
        window.exportCsv = exportCsv;
      `}} />
    </div>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: "4px 10px",
        background: active ? "var(--vertigo-purple)" : "var(--vertigo-panel)",
        color: active ? "#fff" : "var(--vertigo-muted)",
        borderRadius: "999px",
        fontSize: "11px",
        textDecoration: "none",
        fontWeight: active ? 700 : 400,
        border: `1px solid ${active ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
      }}
    >
      {label}
    </Link>
  );
}
