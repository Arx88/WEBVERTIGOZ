/**
 * Log de acciones del staff (admin_action_log).
 *
 * Cada write que hace un admin desde el panel queda registrado:
 * qué acción, sobre qué entidad (con nombre humano legible),
 * con qué datos y QUIÉN la ejecutó. Complementa al draw_audit_log
 * (criptográfico, exclusivo de sorteos) cubriendo el resto del panel.
 *
 * Fail-soft por diseño: si el log falla, la acción del admin NO se
 * interrumpe — se registra el error en consola y se sigue. Un
 * problema de telemetría nunca debe bloquear una operación legítima.
 */

export interface AdminActionLogEntry {
  /** Cliente service role ya autenticado. */
  supabase: any;
  /** account.id del admin que ejecuta la acción (de requireAdminAccount). */
  accountId: string;
  /** Nombre corto de la action, ej: "set_payment_confirmed". */
  action: string;
  /** Tipo de entidad afectada, ej: "team_registration", "tournament_edition". */
  entityType: string;
  /** Id de la entidad afectada (uuid o id de fila). */
  entityId?: string | null;
  /** Nombre humano de la entidad (nombre del equipo, email del admin, etc). */
  entityLabel?: string | null;
  /** Datos del cambio: antes/después, motivo, opciones relevantes. */
  payload?: Record<string, any> | null;
}

export async function logAdminAction(entry: AdminActionLogEntry): Promise<void> {
  try {
    const { error } = await entry.supabase.from("admin_action_log").insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      actor_account_id: entry.accountId,
      payload: entry.payload ?? null,
    });
    if (error) throw error;
  } catch (err: any) {
    console.error(`[admin-audit] No se pudo registrar la acción "${entry.action}" (${entry.entityType}):`, err?.message ?? err);
  }
}
