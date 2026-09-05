import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ScrollText, Shield, Hash, ChevronDown, Megaphone, UserCog } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { fmt } from "@/lib/format";
import ExportCsv from "./export-csv";

export const dynamic = "force-dynamic";

/**
 * Auditoría unificada — 3 fuentes, una pantalla:
 *   1. Sorteos (draw_audit_log): logs inmutables con hash encadenado.
 *   2. Acciones admin (admin_action_log): cada write del panel con actor.
 *   3. Notificaciones (broadcast_log + scheduled_broadcast): envíos y
 *      programados, con quién los creó/envió.
 */

const TABS = [
  { key: "sorteos", label: "Sorteos", href: "/admin/auditoria?tab=sorteos" },
  { key: "acciones", label: "Acciones admin", href: "/admin/auditoria?tab=acciones" },
  { key: "notificaciones", label: "Notificaciones", href: "/admin/auditoria?tab=notificaciones" },
] as const;

const DRAW_BADGE: Record<string, string> = {
  all: "vertigo-badge-purple",
  commit: "vertigo-badge-purple",
  spin_start: "vertigo-badge-warning",
  spin_end: "vertigo-badge-warning",
  reveal: "vertigo-badge-success",
  publish: "vertigo-badge-success",
  cancel: "vertigo-badge-danger",
};

const DRAW_LABEL: Record<string, string> = {
  all: "Todos",
  commit: "Commit",
  spin_start: "Spin start",
  spin_end: "Spin end",
  reveal: "Reveal",
  publish: "Publish",
  cancel: "Cancel",
};

/** Traducción humana de las actions registradas por logAdminAction. */
const ACTION_LABEL: Record<string, string> = {
  generate_real_bracket: "Generar bracket",
  delete_bracket: "Borrar bracket",
  schedule_match: "Programar partido",
  advance_to_lineup: "Pasar a lineups",
  close_comodin_window: "Cerrar comodines",
  report_game_result: "Reportar resultado",
  mark_forfeit: "Marcar W.O.",
  extend_ready_window: "Extender ventana ready",
  start_comodin_window: "Abrir comodines",
  start_match: "Iniciar partida",
  link_aoe2_match: "Vincular match AoE2",
  approve_team: "Aprobar equipo",
  reject_team: "Rechazar equipo",
  set_payment_confirmed: "Confirmar pago",
  toggle_requirement: "Requisito",
  create_edition: "Crear edición",
  update_edition: "Editar edición",
  set_edition_status: "Estado de edición",
  upload_handbook: "Subir handbook",
  toggle_emblem: "Toggle emblema",
  delete_emblem: "Eliminar emblema",
  upload_emblem: "Subir emblema",
  set_caster_tier: "Tier de caster",
  delete_caster: "Eliminar caster",
  set_featured_caster: "Caster destacado",
  save_ruleta_preset: "Guardar preset ruleta",
  save_ruleta_weights: "Guardar pesos ruleta",
  toggle_ruleta_option: "Toggle opción ruleta",
  set_admin_role: "Rol de staff",
  cancel_scheduled_broadcast: "Cancelar aviso programado",
};

/** Para qué entidad existe página pública a la que linkear. */
function entityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "team_registration": return `/equipos/${entityId}`;
    case "match": return `/partido/${entityId}`;
    case "match_game": return null; // se ve desde el partido, no tiene página propia
    case "tournament_edition": return "/torneo";
    default: return null;
  }
}

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const params = await searchParams;
  const tab: string = params.tab ?? "sorteos";
  const drawFilter = params.filter ?? "all";

  // Cargar la fuente del tab activo + counts para las stats del hero
  let logs: any[] = [];
  let broadcasts: any[] = [];
  let scheduled: any[] = [];

  if (tab === "sorteos") {
    let query = supabase
      .from("draw_audit_log")
      .select(`
        id, event_type, hash_chain, previous_hash, payload, created_at,
        draw:draw_id (commit_hash, revealed_seed, status ),
        actor:actor_account_id (display_name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(200);
    if (drawFilter !== "all") query = query.eq("event_type", drawFilter);
    const { data } = (await query) as { data: any };
    logs = data ?? [];
  } else if (tab === "acciones") {
    const { data } = (await supabase
      .from("admin_action_log")
      .select(`
        id, action, entity_type, entity_id, entity_label, payload, created_at,
        actor:actor_account_id (display_name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(200)) as { data: any };
    logs = data ?? [];
  } else {
    const [{ data: bData }, { data: sData }] = (await Promise.all([
      supabase
        .from("broadcast_log")
        .select("id, audience, type, title, body, link, email_sent, targets, sent_at, sender:sent_by_account_id (display_name, email)")
        .order("sent_at", { ascending: false })
        .limit(100),
      supabase
        .from("scheduled_broadcast")
        .select("id, audience, title, body, link, email, scheduled_for, status, sent_at, created_at, creator:created_by_account_id (display_name, email)")
        .order("created_at", { ascending: false })
        .limit(100),
    ])) as [{ data: any }, { data: any }];
    broadcasts = bData ?? [];
    scheduled = sData ?? [];
  }

  const { count: drawTotal } = (await supabase
    .from("draw_audit_log")
    .select("id", { count: "exact", head: true })) as { count: number | null };
  const { count: actionTotal } = (await supabase
    .from("admin_action_log")
    .select("id", { count: "exact", head: true })) as { count: number | null };

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="AUDITORÍA"
        title="Registro completo"
        desc="Todo lo que pasa en el torneo, con responsable: sorteos con verificación criptográfica, cada acción del panel de admin y cada notificación enviada."
        stats={[
          { value: drawTotal ?? 0, label: "Eventos de sorteo" },
          { value: actionTotal ?? 0, label: "Acciones admin", color: "var(--vertigo-purple-pale)" },
          { value: broadcasts.length, label: "Envíos (últ. 100)", color: "var(--vertigo-success)" },
          { value: scheduled.filter((s: any) => s.status === "pending").length, label: "Programados pendientes", color: "#fbbf24" },
        ]}
      />

      {/* Tabs: una por fuente (patrón Cinzel de edition-forms) */}
      <section className="mb-8">
        <div className="mb-6 flex flex-wrap gap-1.5 border-b border-[var(--vertigo-line-soft)] pb-4" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Link
                key={t.key}
                href={t.href}
                role="tab"
                aria-selected={active}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 font-cinzel text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-[rgba(212,175,55,0.5)] bg-[rgba(124,58,237,0.18)] text-white"
                    : "border-transparent text-[#a99fc0] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
                }`}
              >
                {t.key === "sorteos" && <ScrollText className={`h-3.5 w-3.5 ${active ? "text-[#D4AF37]" : ""}`} />}
                {t.key === "acciones" && <UserCog className={`h-3.5 w-3.5 ${active ? "text-[#D4AF37]" : ""}`} />}
                {t.key === "notificaciones" && <Megaphone className={`h-3.5 w-3.5 ${active ? "text-[#D4AF37]" : ""}`} />}
                {t.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Tab 1: Sorteos (draw_audit_log) ─────────────────── */}
      {tab === "sorteos" && (
        <>
          <section className="mb-8">
            <div className="vertigo-subtitle">Filtros</div>
            <div className="vertigo-action-bar">
              {Object.entries(DRAW_LABEL).map(([key, label]) => (
                <a
                  key={key}
                  href={key === "all"
                    ? "/admin/auditoria?tab=sorteos"
                    : `/admin/auditoria?tab=sorteos&filter=${key}`}
                  className={`vertigo-badge ${drawFilter === key ? "vertigo-badge-success" : DRAW_BADGE[key] ?? "vertigo-badge-purple"}`}
                >
                  {label}
                </a>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <div className="vertigo-action-bar">
              <ExportCsv
                filename="auditoria-sorteos"
                headers={["Evento", "Actor", "Fecha", "Hash"]}
                rows={logs.map((log: any) => [
                  DRAW_LABEL[log.event_type] ?? log.event_type,
                  log.actor?.display_name ?? log.actor?.email ?? "—",
                  fmt.dateTime(log.created_at),
                  log.hash_chain ?? "",
                ])}
              />
            </div>
          </section>

          <section>
            <div className="vertigo-subtitle">
              Eventos
              <span className="vertigo-badge vertigo-badge-purple ml-2">{logs.length}</span>
            </div>
            {logs.length === 0 ? (
              <div className="vertigo-card">
                <div className="vertigo-empty">
                  <ScrollText className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                  <div className="vertigo-empty-title">Sin eventos de sorteo</div>
                  <p className="vertigo-empty-desc">
                    Los sorteos se registran acá con hash encadenado cuando se generan desde el panel de partidos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {logs.map((log: any) => (
                  <div key={log.id} className="vertigo-card">
                    <div className="vertigo-card-header">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`vertigo-badge ${DRAW_BADGE[log.event_type] ?? "vertigo-badge-purple"} flex-none`}>
                          {DRAW_LABEL[log.event_type] ?? log.event_type}
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
        </>
      )}

      {/* ── Tab 2: Acciones admin (admin_action_log) ────────── */}
      {tab === "acciones" && (
        <>
          <section className="mb-8">
            <div className="vertigo-action-bar">
              <ExportCsv
                filename="auditoria-acciones-admin"
                headers={["Acción", "Actor", "Entidad", "Detalle", "Fecha"]}
                rows={logs.map((log: any) => [
                  ACTION_LABEL[log.action] ?? log.action,
                  log.actor?.display_name ?? log.actor?.email ?? "—",
                  log.entity_type,
                  log.entity_label ?? log.entity_id ?? "",
                  fmt.dateTime(log.created_at),
                ])}
              />
            </div>
          </section>

          <section>
            <div className="vertigo-subtitle">
              Acciones
              <span className="vertigo-badge vertigo-badge-purple ml-2">{logs.length}</span>
            </div>
            {logs.length === 0 ? (
              <div className="vertigo-card">
                <div className="vertigo-empty">
                  <UserCog className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                  <div className="vertigo-empty-title">Sin acciones registradas</div>
                  <p className="vertigo-empty-desc">
                    Cada cambio que haga el staff desde el panel (aprobar equipos, editar la edición,
                    presets de ruleta, brackets, jornadas, staff) queda acá con el responsable.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {logs.map((log: any) => {
                  const href = entityHref(log.entity_type, log.entity_id);
                  return (
                    <div key={log.id} className="vertigo-card">
                      <div className="vertigo-card-header">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="vertigo-badge vertigo-badge-purple flex-none">
                            {ACTION_LABEL[log.action] ?? log.action}
                          </span>
                          <div className="min-w-0">
                            <div className="font-cinzel text-sm text-[var(--vertigo-text)] truncate">
                              {href ? (
                                <Link href={href} className="hover:text-[var(--vertigo-purple-pale)] underline decoration-[var(--vertigo-purple-soft)] underline-offset-4">
                                  {log.entity_label || log.entity_type}
                                </Link>
                              ) : (
                                log.entity_label || log.entity_type
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--vertigo-faint)] mt-0.5">
                              {log.actor?.display_name ?? log.actor?.email ?? "—"} ·{" "}
                              {fmt.dateTime(log.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-none text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">
                          {log.entity_type}
                        </div>
                      </div>

                      {log.payload && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-[var(--vertigo-purple-soft)] flex items-center gap-1 hover:text-[var(--vertigo-purple-pale)]">
                            <ChevronDown style={{ width: 12, height: 12 }} />
                            Detalle
                          </summary>
                          <pre className="mt-2 p-3 bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-line-soft)] rounded-md text-[11px] text-[var(--vertigo-muted)] overflow-x-auto font-mono">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Tab 3: Notificaciones ───────────────────────────── */}
      {tab === "notificaciones" && (
        <>
          <section className="mb-8">
            <div className="vertigo-action-bar">
              <ExportCsv
                filename="auditoria-notificaciones"
                headers={["Tipo", "Título", "Audiencia", "Responsable", "Fecha", "Destinatarios", "Estado"]}
                rows={[
                  ...broadcasts.map((b: any) => [
                    "Enviado",
                    b.title,
                    b.audience,
                    b.sender?.display_name ?? b.sender?.email ?? "—",
                    fmt.dateTime(b.sent_at),
                    String(b.targets ?? 0),
                    b.email_sent ? "enviado+email" : "enviado",
                  ]),
                  ...scheduled.map((s: any) => [
                    "Programado",
                    s.title,
                    s.audience,
                    s.creator?.display_name ?? s.creator?.email ?? "—",
                    fmt.dateTime(s.scheduled_for),
                    "",
                    s.status,
                  ]),
                ]}
              />
            </div>
          </section>

          <section className="mb-8">
            <div className="vertigo-subtitle">
              Enviados
              <span className="vertigo-badge vertigo-badge-purple ml-2">{broadcasts.length}</span>
            </div>
            {broadcasts.length === 0 ? (
              <div className="vertigo-card">
                <div className="vertigo-empty">
                  <Megaphone className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                  <div className="vertigo-empty-title">Sin envíos</div>
                  <p className="vertigo-empty-desc">Los avisos masivos enviados desde el panel aparecen acá.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {broadcasts.map((b: any) => (
                  <div key={b.id} className="vertigo-card">
                    <div className="vertigo-card-header">
                      <div className="min-w-0">
                        <div className="font-cinzel text-sm text-[var(--vertigo-text)] truncate">{b.title}</div>
                        <div className="text-[11px] text-[var(--vertigo-faint)] mt-0.5">
                          {b.sender?.display_name ?? b.sender?.email ?? "—"} · {fmt.dateTime(b.sent_at)}
                        </div>
                      </div>
                      <div className="text-right flex-none flex flex-col items-end gap-1">
                        <span className="vertigo-badge vertigo-badge-purple">{b.audience}</span>
                        <span className="text-[11px] text-[var(--vertigo-muted)]">
                          {b.targets} destinatario{b.targets === 1 ? "" : "s"}
                          {b.email_sent ? " · +email" : ""}
                        </span>
                      </div>
                    </div>
                    {b.body && (
                      <p className="text-sm text-[var(--vertigo-muted)] mt-2 leading-relaxed">{b.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="vertigo-subtitle">
              Programados
              <span className="vertigo-badge vertigo-badge-purple ml-2">{scheduled.length}</span>
            </div>
            {scheduled.length === 0 ? (
              <div className="vertigo-card">
                <div className="vertigo-empty">
                  <Megaphone className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                  <div className="vertigo-empty-title">Sin avisos programados</div>
                  <p className="vertigo-empty-desc">Los avisos con fecha futura programados desde el panel aparecen acá con su responsable.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {scheduled.map((s: any) => (
                  <div key={s.id} className="vertigo-card">
                    <div className="vertigo-card-header">
                      <div className="min-w-0">
                        <div className="font-cinzel text-sm text-[var(--vertigo-text)] truncate">{s.title}</div>
                        <div className="text-[11px] text-[var(--vertigo-faint)] mt-0.5">
                          {s.creator?.display_name ?? s.creator?.email ?? "—"} · para {fmt.dateTime(s.scheduled_for)}
                        </div>
                      </div>
                      <div className="text-right flex-none flex flex-col items-end gap-1">
                        <span className="vertigo-badge vertigo-badge-purple">{s.audience}</span>
                        <span className={`vertigo-badge ${
                          s.status === "pending" ? "vertigo-badge-warning"
                          : s.status === "sent" ? "vertigo-badge-success"
                          : s.status === "cancelled" ? "vertigo-badge-danger"
                          : "vertigo-badge-purple"
                        }`}>
                          {s.status}
                        </span>
                      </div>
                    </div>
                    {s.body && (
                      <p className="text-sm text-[var(--vertigo-muted)] mt-2 leading-relaxed">{s.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
