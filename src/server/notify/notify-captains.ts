import { getSupabaseServiceRole } from "@/lib/supabase/server";

/**
 * Avisos automáticos a los CAPITANES de una llave (ambos equipos).
 * Canal: in-app (insert en `notification` → campana + toast por Realtime).
 *
 * Dos fuentes:
 *  1) Acciones del ciclo de vida (eventos no dependen del reloj):
 *       confirmReadyAction        → "open"           (ambos ESTOY LISTO)
 *       advanceToLineupAction     → "lineup"         (sorteo → declarar lineup)
 *       confirmLineupReadyAction  → "comodin_window" (ambos lineup listo, comodines)
 *  2) "ready_window" (apertura ESTOY LISTO) — por reloj → notifyReadyWindowOpen().
 *
 * Los capitanes se resuelven por match.team_a_id/team_b_id (team_registration)
 * → team_account.owner_id, el mismo patrón que usa el broadcast admin.
 */

export type CaptainEvent = "open" | "lineup" | "comodin_window" | "wo";

const READY_WINDOW_MIN = 15;
const GRACE_MIN = 15;
const EVENT_TYPE_READY = "match_ready";

const EVENT_META: Record<
  Exclude<CaptainEvent, "wo">,
  { type: string; title: (opp: string) => string; body: (opp: string) => string }
> = {
  open: {
    type: "match_open",
    title: (opp) => `Llave habilitada — vs ${opp}`,
    body: () =>
      "Ambos equipos confirmaron ESTOY LISTO. La llave quedó habilitada y arranca el sorteo.",
  },
  lineup: {
    type: "match_lineup",
    title: (opp) => `Declará tu lineup — vs ${opp}`,
    body: () =>
      "La llave entró en fase de lineup. Elegí tus 3 jugadores y su civilización antes de que cierre.",
  },
  comodin_window: {
    type: "comodin_open",
    title: (opp) => `Ventana de comodines — vs ${opp}`,
    body: () => "Tenés 5 minutos para usar tus comodines. ¡No los dejes pasar!",
  },
};

/** Capitanes (owner + nombre del rival) de una llave. */
async function resolveCaptains(
  service: any,
  match: { team_a_id: string | null; team_b_id: string | null }
) {
  const { team_a_id, team_b_id } = match;
  const regIds = [team_a_id, team_b_id].filter(Boolean);
  if (regIds.length < 2) return [];

  const { data: regs } = (await service
    .from("team_registration")
    .select("id, team_account_id")
    .in("id", regIds)) as { data: any };
  const regToTeam: Record<string, string> = {};
  for (const r of regs ?? []) if (r.team_account_id) regToTeam[r.id] = r.team_account_id;

  const teamIds = [...new Set(Object.values(regToTeam))];
  if (teamIds.length === 0) return [];

  const { data: teams } = (await service
    .from("team_account")
    .select("id, name, owner_id")
    .in("id", teamIds)) as { data: any };
  const teamById: Record<string, { name: string; owner: string }> = {};
  for (const t of teams ?? []) if (t.owner_id) teamById[t.id] = { name: t.name ?? "—", owner: t.owner_id };

  const out: Array<{ regId: string; owner: string; oppName: string }> = [];
  for (const [regId, teamId] of Object.entries(regToTeam)) {
    const me = teamById[teamId];
    if (!me) continue;
    const oppRegId = (regId === team_a_id ? team_b_id : team_a_id) ?? "";
    const opp = teamById[regToTeam[oppRegId]];
    out.push({ regId, owner: me.owner, oppName: opp?.name ?? "el rival" });
  }
  return out;
}

export async function notifyMatchCaptains(
  matchId: string,
  event: CaptainEvent,
  /** Solo event="wo": team_registration que ganó por presencia. */
  woWinnerRegId?: string | null
) {
  const service = getSupabaseServiceRole() as any;
  const { data: match } = (await service
    .from("match")
    .select("team_a_id, team_b_id")
    .eq("id", matchId)
    .maybeSingle()) as { data: any };
  if (!match) return { sent: 0 };

  const captains = await resolveCaptains(service, match);
  if (captains.length === 0) return { sent: 0 };

  const now = new Date().toISOString();
  const rows = captains.map((c) => {
    // W.O. resuelto por presencia: cada capitán recibe SU lado del resultado.
    if (event === "wo") {
      const won = c.regId === woWinnerRegId;
      return {
        account_id: c.owner,
        type: "match_wo",
        title: won ? `Ganaste por W.O. — vs ${c.oppName}` : `W.O. — perdiste vs ${c.oppName}`,
        body: won
          ? "El rival no confirmó READY dentro del tiempo. La llave quedó a tu favor y avanzás en el bracket."
          : "No confirmaste READY dentro del tiempo: el rival avanzó por W.O.",
        link: `/partido/${matchId}`,
        match_id: matchId,
        created_at: now,
      };
    }
    const meta = EVENT_META[event];
    return {
      account_id: c.owner,
      type: meta.type,
      title: meta.title(c.oppName),
      body: meta.body(c.oppName),
      link: `/partido/${matchId}`,
      match_id: matchId,
      created_at: now,
    };
  });

  const { error } = await service.from("notification").insert(rows);
  if (error) return { sent: 0, error: error.message };
  return { sent: rows.length };
}

/** ¿La ventana ESTOY LISTO está abierta ahora? (15 min antes → 15 min de gracia). */
function isReadyWindowOpen(scheduledAtStart: string | null, nowMs: number): boolean {
  if (!scheduledAtStart) return false;
  const start = new Date(scheduledAtStart).getTime();
  const openAt = start - READY_WINDOW_MIN * 60_000;
  const deadline = start + GRACE_MIN * 60_000;
  return nowMs >= openAt && nowMs < deadline;
}

/** Resuelve capitanes e inserta el aviso match_ready (con hora límite) para una llave. */
async function insertReadyNotifications(
  service: any,
  match: { id: string; scheduled_at_start: string | null; team_a_id: string | null; team_b_id: string | null }
): Promise<number> {
  const captains = await resolveCaptains(service, match);
  if (captains.length === 0) return 0;

  const now = Date.now();
  const startMs = match.scheduled_at_start ? new Date(match.scheduled_at_start).getTime() : now;
  const deadline = startMs + GRACE_MIN * 60_000;
  const deadlineLabel = new Date(deadline).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nowIso = new Date().toISOString();
  const rows = captains.map((c) => ({
    account_id: c.owner,
    type: EVENT_TYPE_READY,
    title: `Se abre tu llave — vs ${c.oppName}`,
    body: `Se habilitó la ventana para confirmar ESTOY LISTO. Tenés hasta las ${deadlineLabel} o la llave se define por W.O.`,
    link: `/partido/${match.id}`,
    match_id: match.id,
    created_at: nowIso,
  }));

  const { error } = await service.from("notification").insert(rows);
  return error ? 0 : rows.length;
}

/**
 * Avisa la apertura de la ventana ESTOY LISTO para UNA llave (disparo preciso).
 * Lo llama el webhook de QStash en el instante exacto. Con `expectedScheduledAtStart`
 * valida que el match siga programado para ese horario (evita avisos stale tras
 * reprogramar) y deduplica notificando una sola vez por llave.
 */
export async function notifyReadyWindow(matchId: string, expectedScheduledAtStart?: string | null) {
  const service = getSupabaseServiceRole() as any;
  const { data: match } = (await service
    .from("match")
    .select("id, status, scheduled_at_start, team_a_id, team_b_id")
    .eq("id", matchId)
    .maybeSingle()) as { data: { id: string; status: string; scheduled_at_start: string | null; team_a_id: string | null; team_b_id: string | null } };

  if (!match) return { sent: 0, skipped: "no-match" as const };
  // Comparar por valor de tiempo (no string): Postgres devuelve "+00:00" y el
  // payload de QStash lleva "Z" — mismo instante, distinto formato.
  if (expectedScheduledAtStart != null) {
    const ok =
      match.scheduled_at_start != null &&
      new Date(expectedScheduledAtStart).getTime() === new Date(match.scheduled_at_start).getTime();
    if (!ok) return { sent: 0, skipped: "stale-time" as const };
  }
  if (match.status !== "scheduled") return { sent: 0, skipped: "not-scheduled" as const };
  if (!isReadyWindowOpen(match.scheduled_at_start, Date.now())) {
    return { sent: 0, skipped: "window-closed" as const };
  }

  const { data: existing } = (await service
    .from("notification")
    .select("id")
    .eq("type", EVENT_TYPE_READY)
    .eq("match_id", matchId)
    .limit(1)) as { data: any };
  if ((existing ?? []).length > 0) return { sent: 0, skipped: "already-notified" as const };

  const sent = await insertReadyNotifications(service, match);
  return { sent };
}

/**
 * Scan por polling (respaldado para /api/cron/notify-lifecycle y la Edge Function
 * notify-lifecycle, mismo criterio). El disparo principal es QStash (preciso).
 */
export async function notifyReadyWindowOpen() {
  const service = getSupabaseServiceRole() as any;
  const now = Date.now();

  const { data: matches } = (await service
    .from("match")
    .select("id, scheduled_at_start, team_a_id, team_b_id")
    .eq("status", "scheduled")
    .not("scheduled_at_start", "is", null)) as { data: Array<{ id: string; scheduled_at_start: string | null; team_a_id: string | null; team_b_id: string | null }> };

  const all = matches ?? [];
  const candidates = all.filter((m) => isReadyWindowOpen(m.scheduled_at_start, now));
  if (candidates.length === 0) return { scanned: all.length, sent: 0 };

  const ids = candidates.map((m) => m.id);
  const { data: existing } = (await service
    .from("notification")
    .select("match_id")
    .eq("type", EVENT_TYPE_READY)
    .in("match_id", ids)) as { data: Array<{ match_id: string }> };
  const notified = new Set((existing ?? []).map((n) => n.match_id));
  const toNotify = candidates.filter((m) => !notified.has(m.id));

  let sent = 0;
  for (const m of toNotify) sent += await insertReadyNotifications(service, m);
  return { scanned: all.length, candidates: toNotify.length, sent };
}
