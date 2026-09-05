import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { approveTeamAction, rejectTeamAction } from "@/server/actions/auth";
import { toggleRequirementAction, setPaymentConfirmedAction } from "@/server/actions/requirements";
import { Check, X, Users, Crown, AlertTriangle, Clock, RotateCcw, CreditCard, Hourglass, ShieldCheck, Ban, Undo2, ExternalLink } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

// Requisitos de inscripción que el staff puede marcar/desmarcar con un clic
const REQUIREMENTS = [
  { field: "anti_smurf_check", label: "Anti Smurf" },
  { field: "payment_confirmed", label: "Pago" },
  { field: "tutorial_watched", label: "Tutorial" },
  { field: "discord_joined", label: "Discord" },
] as const;

type Reg = any;

export default async function AdminEquiposPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account").select("id, role, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) redirect("/mi-equipo");

  const { data: registrations } = (await supabase
    .from("team_registration")
    .select("id, status, status_reason, elo_freeze_snapshot, elo_verification_status, elo_verification_reason, submitted_at, approved_at, payment_deadline_at, anti_smurf_check, payment_confirmed, tutorial_watched, discord_joined, team_account:team_account_id (id, name, tagline, emblem_id, emblem:emblem_id (image_url)), tournament_edition:tournament_edition_id (name, elo_cap, elo_tolerance)")
    .order("submitted_at", { ascending: false })) as { data: any };

  const regsWithPlayers: Reg[] = await Promise.all(
    (registrations ?? []).map(async (reg: any) => {
      const { data: players } = (await supabase
        .from("player_registration")
        .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, is_verified, aoe2_profile_id")
        .eq("team_registration_id", reg.id).order("is_captain", { ascending: false })) as { data: any };
      return { ...reg, players: players ?? [] };
    })
  );

  const pending = regsWithPlayers.filter((r: Reg) => r.status === "pending");
  const approved = regsWithPlayers.filter((r: Reg) => r.status === "approved");
  const rejected = regsWithPlayers.filter((r: Reg) => r.status === "rejected");

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        compact
        kicker="INSCRIPCIONES"
        title="Equipos"
        desc="Revisá y aprobá cada inscripción. Verificá ELO cap, perfiles de AoE2 Companion y datos del equipo antes de confirmar."
        stats={[
          { value: regsWithPlayers.length, label: "Total" },
          { value: pending.length, label: "Pendientes", color: "#fbbf24" },
          { value: approved.length, label: "Aprobados", color: "var(--vertigo-success)" },
          { value: rejected.length, label: "Rechazados", color: "var(--vertigo-danger)" },
        ]}
      />

      {regsWithPlayers.length === 0 ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <Users className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
            <div className="vertigo-empty-title">Sin inscripciones</div>
            <p className="vertigo-empty-desc">Todavía no hay equipos inscriptos. Cuando empiecen a registrarse, vas a verlos acá.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <Section id="pendientes" icon={<Hourglass style={{ width: 13, height: 13 }} />} title="Pendientes de aprobación" count={pending.length} empty="No hay equipos pendientes — todo al día.">
            {pending.map((reg: Reg) => (
              <TeamCard
                key={reg.id}
                reg={reg}
                showActions={true}
                approveAction={approveTeamAction.bind(null, reg.id)}
                rejectAction={rejectTeamAction.bind(null, reg.id)}
              />
            ))}
          </Section>

          <Section id="aprobados" icon={<ShieldCheck style={{ width: 13, height: 13 }} />} title="Aprobados" count={approved.length} empty="Ningún equipo aprobado todavía.">
            {approved.map((reg: Reg) => (
              <TeamCard
                key={reg.id}
                reg={reg}
                showActions={false}
                // Pago: si ya está confirmado → acción de CANCELAR la confirmación
                // (pago rechazado / reversa). Si falta confirmar → Confirmar pago.
                paymentAction={
                  reg.payment_confirmed
                    ? setPaymentConfirmedAction.bind(null, reg.id, false)
                    : setPaymentConfirmedAction.bind(null, reg.id, true)
                }
              />
            ))}
          </Section>

          <Section id="rechazados" icon={<Ban style={{ width: 13, height: 13 }} />} title="Rechazados" count={rejected.length} empty="No hay equipos rechazados.">
            {rejected.map((reg: Reg) => (
              <TeamCard
                key={reg.id}
                reg={reg}
                showActions={false}
                graceAction={
                  reg.status_reason === "payment_timeout"
                    ? setPaymentConfirmedAction.bind(null, reg.id, true)
                    : undefined
                }
                showCancelPayment={true}
              />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  count,
  empty,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`sec-${id}`} className="ad-section">
      <div className="ad-section-head">
        <span className="ad-section-icon">{icon}</span>
        <h2 className="ad-section-title">{title}</h2>
        <span className={`ad-section-count ${id}`}>{count}</span>
        <span className="ad-section-line" />
      </div>
      {count === 0 ? (
        <div className="ad-empty">{empty}</div>
      ) : (
        <div className="ad-team-list">{children}</div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Tarjeta de equipo — grilla de zonas fijas: franja de estado +
// escudo + identidad | ELO | jugadores. Nada flota ni se pisa.
// ─────────────────────────────────────────────────────────────
function TeamCard({
  reg,
  showActions,
  approveAction,
  rejectAction,
  paymentAction,
  graceAction,
  showCancelPayment,
}: {
  reg: Reg;
  showActions: boolean;
  approveAction?: () => Promise<void>;
  rejectAction?: () => Promise<void>;
  paymentAction?: () => Promise<void>;
  graceAction?: () => Promise<void>;
  showCancelPayment?: boolean;
}) {
  const team = reg.team_account;
  const edition = reg.tournament_edition;
  const players: any[] = reg.players ?? [];
  const eloCap = (edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20);
  const elo = reg.elo_freeze_snapshot;
  const isEloOk = !elo || elo <= eloCap;
  const eloPct = elo ? Math.min(100, Math.round((elo / eloCap) * 100)) : 0;
  const doneCount = REQUIREMENTS.filter((r) => !!reg[r.field]).length;

  const eloVerificationBadge = (() => {
    switch (reg.elo_verification_status) {
      case "verified":
        return { cls: "ok", label: "ELO verificado" };
      case "pending":
        return { cls: "warn", label: "ELO pendiente" };
      case "hidden":
        return { cls: "warn", label: "Perfil oculto" };
      case "failed":
        return { cls: "bad", label: "ELO falló" };
      default:
        return null;
    }
  })();

  // Plazo de pago (0014): aprobado sin pagar → chip con la cuenta regresiva;
  // vencido, el cron /api/cron/payment-deadline libera la plaza solo.
  const paymentChip = (() => {
    if (reg.status !== "approved" || reg.payment_confirmed || !reg.payment_deadline_at) return null;
    const hoursLeft = Math.ceil((new Date(reg.payment_deadline_at).getTime() - Date.now()) / 3_600_000);
    if (hoursLeft <= 0) return { text: "Pago vencido — la plaza se libera", tone: "bad" as const };
    if (hoursLeft <= 24) return { text: `Pago vence en ${hoursLeft}h`, tone: "warn" as const };
    return { text: `Pago vence en ${hoursLeft}h`, tone: "muted" as const };
  })();

  const status = reg.status as "pending" | "approved" | "rejected";

  return (
    <article className={`ad-card ad-card-${status}`}>
      {/* Franja de estado */}
      <span className="ad-card-rail" aria-hidden />

      {/* ── Cabecera: escudo + identidad | ELO ─────────────────── */}
      <header className="ad-card-head">
        <div className="ad-crest">
          {team?.emblem?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.emblem.image_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="ad-crest-fallback">{(team?.name ?? "?").charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="ad-id">
          <div className="ad-id-top">
            <h3 className="ad-name" title={team?.name ?? undefined}>
              <Link href={`/equipos/${reg.id}`} className="ad-name-link" title={`Ver perfil de ${team?.name ?? "equipo"}`}>{team?.name ?? "—"}</Link>
            </h3>
            {team?.tagline && <span className="ad-tagline" title={team.tagline}>&ldquo;{team.tagline}&rdquo;</span>}
          </div>
          <div className="ad-meta">
            <span className="ad-meta-item">{edition?.name ?? "—"}</span>
            <span className="ad-meta-dot" />
            <span className="ad-meta-item">
              <Clock style={{ width: 11, height: 11, flex: "none" }} />
              {fmt.date(reg.submitted_at)}
            </span>
            {paymentChip && (
              <>
                <span className="ad-meta-dot" />
                <span className={`ad-chip ad-chip-${paymentChip.tone}`}>{paymentChip.text}</span>
              </>
            )}
          </div>
          {/* Badges de verificación de ELO — fila propia, nunca sobre el título */}
          {(eloVerificationBadge || !isEloOk) && (
            <div className="ad-flags">
              {eloVerificationBadge && (
                <span className={`ad-flag ad-flag-${eloVerificationBadge.cls}`}>
                  {eloVerificationBadge.cls === "bad" ? <AlertTriangle style={{ width: 10, height: 10 }} /> : null}
                  {eloVerificationBadge.label}
                </span>
              )}
              {!isEloOk && (
                <span className="ad-flag ad-flag-bad">
                  <AlertTriangle style={{ width: 10, height: 10 }} />
                  Supera ELO cap
                </span>
              )}
            </div>
          )}
        </div>

        {/* ELO — bloque compacto alineado a la derecha de la cabecera */}
        <div className={`ad-elo ${!isEloOk ? "ad-elo-over" : ""}`}>
          <span className="ad-elo-label">ELO total</span>
          <span className="ad-elo-value">{elo ?? "—"}</span>
          <span className="ad-elo-cap">/ {eloCap}</span>
          <span className="ad-elo-bar" aria-hidden>
            <i style={{ width: `${eloPct}%` }} />
          </span>
        </div>
      </header>

      {/* ── Cuerpo: jugadores ──────────────────────────────────── */}
      <div className="ad-card-body">
        <div className="ad-body-label">
          Jugadores
          <span className="ad-body-count">{players.length}/3</span>
        </div>        <div className="ad-players">
          {[...players]
            .sort((a: any, b: any) =>
              (b.is_captain ? 1 : 0) - (a.is_captain ? 1 : 0) ||
              (b.max_rating_rm_1v1 ?? 0) - (a.max_rating_rm_1v1 ?? 0)
            )
            .map((p: any) => (
            <div key={p.id} className={`ad-player ${p.is_captain ? "ad-player-captain" : ""}`}>
              <span className="ad-player-avatar">{(p.display_name ?? "?").charAt(0).toUpperCase()}</span>
              <span className="ad-player-main">
                <span className="ad-player-name" title={p.display_name}>
                  {p.is_captain && (
                    <span className="ad-cap-chip">
                      <Crown style={{ width: 9, height: 9 }} />
                      Capitán
                    </span>
                  )}
                  <span className="ad-player-nm" title={p.display_name}>
                    <Link href={`/jugadores/${p.id}`} className="ad-player-link" title={`Ver perfil de ${p.display_name}`}>{p.display_name}</Link>
                  </span>
                  {p.is_verified && <Check style={{ width: 12, height: 12, color: "var(--vertigo-success)", flex: "none" }} strokeWidth={2.5} />}
                </span>
                <span className="ad-player-sub">
                  {p.country ?? "—"} · #{p.aoe2_profile_id}
                  <a
                    href={`https://aoe2companion.com/app/profile/${p.aoe2_profile_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ad-player-companion"
                    title={`Abrir perfil AoE2 Companion #${p.aoe2_profile_id} (tab nueva)`}
                  >
                    <ExternalLink style={{ width: 11, height: 11 }} />
                    Companion
                  </a>
                </span>
              </span>
              <span className="ad-player-elo">
                {p.max_rating_rm_1v1 !== null && p.max_rating_rm_1v1 !== undefined ? p.max_rating_rm_1v1.toLocaleString() : "—"}
                <em>ELO</em>
              </span>
            </div>
          ))}
          {players.length === 0 && <div className="ad-empty" style={{ gridColumn: "1 / -1", margin: 0 }}>Sin jugadores cargados</div>}
        </div>

        {/* ── Requisitos: fila de toggles + progreso, en franja propia ── */}
        <div className="ad-reqs">
          <div className="ad-reqs-head">
            <span className="ad-body-label" style={{ margin: 0 }}>Requisitos</span>
            <span className={`ad-reqs-progress ${doneCount === REQUIREMENTS.length ? "full" : ""}`}>
              {doneCount}/{REQUIREMENTS.length}
            </span>
            <span className="ad-reqs-bar" aria-hidden>
              <i style={{ width: `${(doneCount / REQUIREMENTS.length) * 100}%` }} />
            </span>
          </div>
          <div className="ad-req-toggles">
            {REQUIREMENTS.map((r) => {
              const done = !!reg[r.field];
              return (
                <form key={r.field} action={toggleRequirementAction}>
                  <input type="hidden" name="registrationId" value={reg.id} />
                  <input type="hidden" name="field" value={r.field} />
                  <button
                    type="submit"
                    className={`ad-req ${done ? "on" : ""}`}
                    title={done ? `Clic para desmarcar "${r.label}"` : `Clic para marcar "${r.label}"`}
                  >
                    {done ? <Check style={{ width: 11, height: 11 }} strokeWidth={2.5} /> : <X style={{ width: 11, height: 11 }} />}
                    {r.label}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Pie: acciones — una sola fila, alineadas a la derecha ── */}
      {(showActions || paymentAction || graceAction) && (
        <footer className="ad-card-foot">
          {!showActions && (
            <span className="ad-foot-hint">
              {reg.payment_confirmed
                ? "El pago está confirmado — podés cancelar la confirmación si el pago fue rechazado."
                : paymentAction
                ? "La plaza queda asegurada: el cron deja de contarla como impaga."
                : "Re-aprueba la inscripción con el pago confirmado, si la edición todavía tiene lugar."}
            </span>
          )}
          <div className="ad-foot-actions">
            {paymentAction && reg.payment_confirmed && (
              <form action={paymentAction}>
                <button type="submit" className="vertigo-btn vertigo-btn-ghost ad-btn">
                  <Undo2 style={{ width: 13, height: 13 }} />
                  Cancelar confirmación de pago
                </button>
              </form>
            )}
            {paymentAction && !reg.payment_confirmed && (
              <form action={paymentAction}>
                <button type="submit" className="vertigo-btn vertigo-btn-success ad-btn">
                  <CreditCard style={{ width: 13, height: 13 }} />
                  Confirmar pago de la plaza
                </button>
              </form>
            )}
            {graceAction && (
              <form action={graceAction}>
                <button type="submit" className="vertigo-btn vertigo-btn-success ad-btn">
                  <RotateCcw style={{ width: 13, height: 13 }} />
                  Pago fuera de plazo — reactivar
                </button>
              </form>
            )}
            {/* Rechazados que pagaron a tiempo (p. ej. revertidos por error) */}
            {showCancelPayment && reg.payment_confirmed && (
              <form action={setPaymentConfirmedAction.bind(null, reg.id, false)}>
                <button type="submit" className="vertigo-btn vertigo-btn-ghost ad-btn">
                  <Undo2 style={{ width: 13, height: 13 }} />
                  Cancelar confirmación de pago
                </button>
              </form>
            )}
            {showActions && (
              <>
                <form action={rejectAction!}>
                  <button type="submit" className="vertigo-btn vertigo-btn-danger ad-btn">
                    <X style={{ width: 13, height: 13 }} />
                    Rechazar
                  </button>
                </form>
                <form action={approveAction!}>
                  <button type="submit" className="vertigo-btn vertigo-btn-success ad-btn">
                    <Check style={{ width: 13, height: 13 }} />
                    Aprobar
                  </button>
                </form>
              </>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}
