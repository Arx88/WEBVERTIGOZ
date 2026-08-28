/**
 * VÉRTIGO Cup — Ciclo de vida del cupo de la edición (migración 0014).
 *
 * Reglas:
 *  1. Al aprobarse una inscripción, el equipo tiene 72hs (configurable por
 *     edición en `payment_window_hours`) para confirmar el pago de su plaza.
 *  2. Vencido el plazo sin pago, la plaza se libera automáticamente: la
 *     inscripción pasa a 'rejected' con status_reason='payment_timeout' y el
 *     equipo puede re-inscribirse si todavía hay lugar.
 *  3. Cada vez que se libera lugar (por expiración o por rechazo del admin),
 *     se avisa a la waitlist del wizard (cupo_waitlist, migración 0013).
 *
 * Todo corre con service role: lo invoca el cron (/api/cron/payment-deadline)
 * y las server actions de admin. Los envíos fallan grácilmente si no hay
 * RESEND_API_KEY (lib/email) — la waitlist queda sin marcar y se reintenta.
 */
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { sendEmail, emailShell } from "@/lib/email";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
const REGISTER_URL = `${SITE_URL}/registro`;
/** Tope defensivo por corrida para no mandar cientos de mails de golpe. */
const MAX_WAITLIST_EMAILS_PER_RUN = 200;

export interface SlotsFreedResult {
  expired: number;
  editions: string[];
  teamsEmailed: number;
  waitlist: { attempted: number; sent: number };
}

/**
 * Expira las inscripciones aprobadas sin pago confirmado cuyo
 * payment_deadline_at ya venció. Devuelve a qué ediciones les quedó
 * lugar libre y notifica a la waitlist de cada una.
 */
export async function expireUnpaidRegistrations(): Promise<SlotsFreedResult> {
  const service = getSupabaseServiceRole() as any;
  const empty: SlotsFreedResult = { expired: 0, editions: [], teamsEmailed: 0, waitlist: { attempted: 0, sent: 0 } };

  const nowIso = new Date().toISOString();
  const { data: vencidas } = await service
    .from("team_registration")
    .select("id, tournament_edition_id")
    .eq("status", "approved")
    .eq("payment_confirmed", false)
    .not("payment_deadline_at", "is", null)
    .lt("payment_deadline_at", nowIso);
  if (!vencidas?.length) return empty;

  // Anti-carrera: en el update re-exigimos approved + sin pago; si un admin
  // confirmó el pago entre el select y acá, esa fila no se toca.
  const { data: expiredRows, error } = await service
    .from("team_registration")
    .update({ status: "rejected", status_reason: "payment_timeout" })
    .in("id", vencidas.map((r: any) => r.id))
    .eq("status", "approved")
    .eq("payment_confirmed", false)
    .select("id, team_account_id");
  if (error || !expiredRows?.length) {
    if (error) console.error("[cupo] error expirando inscripciones:", error.message);
    return empty;
  }

  // Aviso al equipo que perdió la plaza (con puerta de re-inscripción).
  let teamsEmailed = 0;
  const teamIds = [...new Set(expiredRows.map((r: any) => r.team_account_id).filter(Boolean))];
  if (teamIds.length > 0) {
    const { data: teams } = await service
      .from("team_account")
      .select("id, name, owner:owner_id (email)")
      .in("id", teamIds);
    const byId = new Map<string, any>((teams ?? []).map((t: any) => [t.id as string, t]));
    for (const reg of expiredRows) {
      const team = byId.get(reg.team_account_id);
      const email = team?.owner?.email;
      if (!email) continue;
      const ok = await sendEmail({
        to: email,
        subject: "Tu plaza en la VÉRTIGO Cup fue liberada por falta de pago",
        html: emailShell(
          "Plaza liberada",
          `<p>No se confirmó el pago de la plaza de <strong>${team?.name ?? "tu equipo"}</strong> dentro del plazo de 72 horas, así que la plaza volvió al pool de la edición.</p>
           <p>Si todavía hay lugares disponibles podés <strong>re-inscribirte</strong> completando el wizard de nuevo — el cupo es por orden de llegada.</p>`,
          { href: REGISTER_URL, label: "Ver disponibilidad" }
        ),
      });
      if (ok) teamsEmailed++;
    }
  }

  // Waitlist: una notificación por cada edición que quedó con lugar libre.
  const editionIds = [...new Set(vencidas.map((r: any) => r.tournament_edition_id))] as string[];
  const waitlist = { attempted: 0, sent: 0 };
  for (const editionId of editionIds) {
    const r = await notifyWaitlistIfSlotsAvailable(editionId);
    waitlist.attempted += r.attempted;
    waitlist.sent += r.sent;
  }

  return { expired: expiredRows.length, editions: editionIds, teamsEmailed, waitlist };
}

/**
 * Si la edición quedó con lugares libres (aprobados + pendientes < max_teams),
 * avisa por email a los anotados en la waitlist que todavía no fueron
 * notificados (FIFO, cada email se manda UNA sola vez por edición: al enviar,
 * se marca notified_at y no vuelve a recibir avisos).
 */
export async function notifyWaitlistIfSlotsAvailable(
  editionId: string
): Promise<{ attempted: number; sent: number }> {
  const service = getSupabaseServiceRole() as any;

  const { data: edition } = await service
    .from("tournament_edition")
    .select("id, name, max_teams")
    .eq("id", editionId)
    .maybeSingle();
  if (!edition) return { attempted: 0, sent: 0 };

  const { count } = await service
    .from("team_registration")
    .select("id", { count: "exact", head: true })
    .eq("tournament_edition_id", editionId)
    .in("status", ["approved", "pending"]);
  const remaining = (edition.max_teams ?? 32) - (count ?? 0);
  if (remaining <= 0) return { attempted: 0, sent: 0 };

  const { data: pendientes } = await service
    .from("cupo_waitlist")
    .select("id, email")
    .eq("tournament_edition_id", editionId)
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(MAX_WAITLIST_EMAILS_PER_RUN);
  if (!pendientes?.length) return { attempted: 0, sent: 0 };

  let sent = 0;
  const nowIso = new Date().toISOString();

  // Reclamo atómico ANTES de enviar: marca notified_at primero para que dos
  // corridas en paralelo (cron + sweep por lectura de /api/tournament/slots)
  // no manden el mail doble. Si el envío falla, se libera el reclamo para
  // reintentar en la próxima corrida.
  const { data: claimed } = await service
    .from("cupo_waitlist")
    .update({ notified_at: nowIso })
    .in("id", pendientes.map((r: any) => r.id))
    .is("notified_at", null)
    .select("id, email");
  if (!claimed?.length) return { attempted: 0, sent: 0 };

  for (const row of claimed) {
    const ok = await sendEmail({
      to: row.email,
      subject: "Se liberó un lugar en la VÉRTIGO Cup",
      html: emailShell(
        "Hay lugar disponible",
        `<p>Se liberaron plazas en <strong>${edition.name}</strong> y hay <strong>${remaining}</strong> lugar(es) disponible(s).</p>
         <p>La inscripción es <strong>por orden de llegada</strong>: completá el wizard cuanto antes para asegurar tu reino.</p>`,
        { href: REGISTER_URL, label: "Inscribir mi equipo" }
      ),
    });
    if (ok) {
      sent++;
    } else {
      // Sin API key o error transitorio: liberar el reclamo para que la
      // próxima corrida lo reintente.
      await service.from("cupo_waitlist").update({ notified_at: null }).eq("id", row.id);
    }
  }
  return { attempted: claimed.length, sent };
}
