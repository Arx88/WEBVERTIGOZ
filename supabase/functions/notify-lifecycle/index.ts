/**
 * notify-lifecycle — avisa a los CAPITANES cuando se abre la ventana
 * "ESTOY LISTO" de una llave programada.
 *
 * Este aviso depende del RELOJ (se abre scheduled_at_start - READY_WINDOW_MIN),
 * no de una acción, así que lo emite una Edge Function agendada cada minuto.
 * Los demás eventos (llave habilitada, lineup, comodines) se disparan en las
 * server actions y no pasan por acá.
 *
 * Canal: in-app (insert en `notification`) → campana + toast por Realtime.
 * Dedup: una notificación `match_ready` por llave (se chequea por match_id).
 *
 * Deploy:
 *   supabase login
 *   supabase link --project-ref <ref>
 *   supabase functions deploy notify-lifecycle
 *
 * Agenda (cada minuto, igual que notify-push/notify-email):
 *   select cron.schedule(
 *     'notify-lifecycle-every-1min', '* * * * *',
 *     $$
 *     select net.http_post(
 *       url := 'https://<ref>.functions.supabase.co/notify-lifecycle',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer ' || <service_role>
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const READY_WINDOW_MIN = 15;
const GRACE_MIN = 15;
const EVENT_TYPE = "match_ready";

function isWindowOpen(scheduledAtStart: string | null, nowMs: number): boolean {
  if (!scheduledAtStart) return false;
  const start = new Date(scheduledAtStart).getTime();
  const openAt = start - READY_WINDOW_MIN * 60_000;
  const deadline = start + GRACE_MIN * 60_000;
  return nowMs >= openAt && nowMs < deadline;
}

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "service role no configurado" }), { status: 500 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const now = Date.now();
  const { data: matches, error } = await sb
    .from("match")
    .select("id, scheduled_at_start, team_a_id, team_b_id")
    .eq("status", "scheduled")
    .not("scheduled_at_start", "is", null);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const candidates = (matches ?? []).filter((m) => isWindowOpen(m.scheduled_at_start, now));
  if (candidates.length === 0) return new Response(JSON.stringify({ scanned: (matches ?? []).length, sent: 0 }));

  // Dedup: esta llave ya fue avisada? (una vez por match)
  const ids = candidates.map((m) => m.id);
  const { data: existing } = await sb
    .from("notification")
    .select("match_id")
    .eq("type", EVENT_TYPE)
    .in("match_id", ids);
  const notified = new Set((existing ?? []).map((n) => n.match_id));
  const toNotify = candidates.filter((m) => !notified.has(m.id));

  let sent = 0;
  for (const m of toNotify) {
    const rows = await buildCaptainRows(sb, m.id, m.team_a_id, m.team_b_id, m.scheduled_at_start, now);
    if (rows.length === 0) continue;
    const { error: insErr } = await sb.from("notification").insert(rows);
    if (!insErr) sent += rows.length;
  }
  return new Response(JSON.stringify({ scanned: (matches ?? []).length, candidates: toNotify.length, sent }));
});

async function buildCaptainRows(
  sb: any,
  matchId: string,
  teamAId: string | null,
  teamBId: string | null,
  scheduledAtStart: string | null,
  nowMs: number
) {
  const regIds = [teamAId, teamBId].filter(Boolean);
  if (regIds.length < 2) return [];

  const { data: regs } = await sb.from("team_registration").select("id, team_account_id").in("id", regIds);
  const regToTeam: Record<string, string> = {};
  for (const r of regs ?? []) if (r.team_account_id) regToTeam[r.id] = r.team_account_id;

  const teamIds = [...new Set(Object.values(regToTeam))];
  if (!teamIds.length) return [];

  const { data: teams } = await sb.from("team_account").select("id, name, owner_id").in("id", teamIds);
  const teamById: Record<string, { name: string; owner: string }> = {};
  for (const t of teams ?? []) if (t.owner_id) teamById[t.id] = { name: t.name ?? "—", owner: t.owner_id };

  // Hasta cuándo pueden confirmar (deadline de W.O.) = inicio + GRACE_MIN.
  const deadlineMs = scheduledAtStart ? new Date(scheduledAtStart).getTime() + GRACE_MIN * 60_000 : null;
  const deadlineLabel = deadlineMs
    ? new Date(deadlineMs).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const now = new Date().toISOString();
  const rows: any[] = [];
  for (const [regId, teamId] of Object.entries(regToTeam)) {
    const me = teamById[teamId];
    if (!me) continue;
    const oppRegId = regId === teamAId ? teamBId : teamAId;
    const opp = teamById[regToTeam[oppRegId]];
    const oppName = opp?.name ?? "el rival";
    rows.push({
      account_id: me.owner,
      type: EVENT_TYPE,
      title: `Se abre tu llave — vs ${oppName}`,
      body: deadlineLabel
        ? `Se habilitó la ventana para confirmar ESTOY LISTO. Tenés hasta las ${deadlineLabel} o la llave se define por W.O.`
        : "Se habilitó la ventana para confirmar ESTOY LISTO. Si no confirmás, la llave se define por W.O.",
      link: `/partido/${matchId}`,
      match_id: matchId,
      created_at: now,
    });
  }
  return rows;
}
