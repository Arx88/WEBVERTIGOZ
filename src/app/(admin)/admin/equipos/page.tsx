import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { approveTeamAction, rejectTeamAction } from "@/server/actions/auth";
import { Shield, Check, X, Users, Star, Crown, AlertTriangle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminEquiposPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account").select("id, role, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) redirect("/mi-equipo");

  const { data: registrations } = (await supabase
    .from("team_registration")
    .select("id, status, elo_freeze_snapshot, elo_verification_status, elo_verification_reason, submitted_at, approved_at, team_account:team_account_id (id, name, tagline, emblem_id), tournament_edition:tournament_edition_id (name, elo_cap, elo_tolerance)")
    .order("submitted_at", { ascending: false })) as { data: any };

  const regsWithPlayers = await Promise.all(
    (registrations ?? []).map(async (reg: any) => {
      const { data: players } = (await supabase
        .from("player_registration")
        .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, is_verified, aoe2_profile_id")
        .eq("team_registration_id", reg.id).order("is_captain", { ascending: false })) as { data: any };
      return { ...reg, players: players ?? [] };
    })
  );

  const pending = regsWithPlayers.filter((r: any) => r.status === "pending");
  const approved = regsWithPlayers.filter((r: any) => r.status === "approved");
  const rejected = regsWithPlayers.filter((r: any) => r.status === "rejected");

  return (
    <div className="vertigo-fade-in">
      <span className="vertigo-kicker">INSCRIPCIONES</span>
      <h1 className="vertigo-title">Equipos</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">
        Revisá y aprobá cada inscripción. Verificá ELO cap, perfiles de AoE2 Companion y datos del equipo antes de confirmar.
      </p>

      <div className="vertigo-stats">
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Total</div>
          <div className="vertigo-stat-value">{regsWithPlayers.length}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Pendientes</div>
          <div className="vertigo-stat-value text-[#fbbf24]">{pending.length}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Aprobados</div>
          <div className="vertigo-stat-value text-[var(--vertigo-success)]">{approved.length}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Rechazados</div>
          <div className="vertigo-stat-value text-[var(--vertigo-danger)]">{rejected.length}</div>
        </div>
      </div>

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
          <Section
            title="Pendientes de aprobación"
            count={pending.length}
            empty="No hay equipos pendientes — todo al día."
          >
            {pending.map((reg: any) => (
              <TeamCard
                key={reg.id}
                reg={reg}
                showActions={true}
                approveAction={approveTeamAction.bind(null, reg.id)}
                rejectAction={rejectTeamAction.bind(null, reg.id)}
              />
            ))}
          </Section>

          <Section title="Aprobados" count={approved.length} empty="Ningún equipo aprobado todavía.">
            {approved.map((reg: any) => (
              <TeamCard key={reg.id} reg={reg} showActions={false} />
            ))}
          </Section>

          <Section title="Rechazados" count={rejected.length} empty="No hay equipos rechazados.">
            {rejected.map((reg: any) => (
              <TeamCard key={reg.id} reg={reg} showActions={false} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="vertigo-subtitle">
        {title}
        <span className="vertigo-badge vertigo-badge-purple ml-2">{count}</span>
      </div>
      {count === 0 ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <div className="vertigo-empty-title">Vacío</div>
            <p className="vertigo-empty-desc">{empty}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </section>
  );
}

function TeamCard({
  reg,
  showActions,
  approveAction,
  rejectAction,
}: {
  reg: any;
  showActions: boolean;
  approveAction?: () => Promise<void>;
  rejectAction?: () => Promise<void>;
}) {
  const team = reg.team_account;
  const edition = reg.tournament_edition;
  const players = reg.players ?? [];
  const eloCap = (edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20);
  const isEloOk = !reg.elo_freeze_snapshot || reg.elo_freeze_snapshot <= eloCap;

  const eloVerificationBadge = (() => {
    switch (reg.elo_verification_status) {
      case "verified":
        return { cls: "vertigo-badge-success", label: "ELO verificado" };
      case "pending":
        return { cls: "vertigo-badge-warning", label: "ELO pendiente" };
      case "hidden":
        return { cls: "vertigo-badge-warning", label: "Perfil oculto" };
      case "failed":
        return { cls: "vertigo-badge-danger", label: "ELO falló" };
      default:
        return null;
    }
  })();

  return (
    <div className="vertigo-card">
      <div className="vertigo-card-header">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="flex items-center justify-center rounded-full border border-[var(--vertigo-purple)] text-[var(--vertigo-purple-soft)] flex-none"
            style={{ width: 44, height: 44 }}
          >
            <Shield style={{ width: 20, height: 20 }} strokeWidth={1.25} />
          </div>
          <div className="min-w-0">
            <div className="font-cinzel text-lg font-semibold text-[var(--vertigo-text)] truncate">
              {team?.name ?? "—"}
            </div>
            {team?.tagline && (
              <div className="text-xs italic text-[var(--vertigo-muted)] truncate">
                &ldquo;{team.tagline}&rdquo;
              </div>
            )}
            <div className="text-[11px] text-[var(--vertigo-faint)] mt-1 flex items-center gap-2 flex-wrap">
              <span>{edition?.name ?? "—"}</span>
              <span>·</span>
              <Clock style={{ width: 11, height: 11 }} />
              <span>Enviado {reg.submitted_at ? new Date(reg.submitted_at).toLocaleDateString("es-AR") : "—"}</span>
            </div>
          </div>
        </div>

        <div className="vertigo-info-card flex-none text-right">
          <div className="vertigo-info-card-label justify-end">ELO Total</div>
          <div
            className="font-cinzel text-2xl font-bold leading-tight"
            style={{ color: isEloOk ? "var(--vertigo-purple-pale)" : "var(--vertigo-danger)" }}
          >
            {reg.elo_freeze_snapshot ?? "—"}
          </div>
          <div className="text-[11px] text-[var(--vertigo-faint)]">/ {eloCap}</div>
        </div>
      </div>

      {eloVerificationBadge && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`vertigo-badge ${eloVerificationBadge.cls}`}>{eloVerificationBadge.label}</span>
          {reg.elo_verification_status === "pending" && (
            <span className="vertigo-badge vertigo-badge-warning">
              <AlertTriangle style={{ width: 11, height: 11 }} />
              Jugador con perfil oculto
            </span>
          )}
          {reg.elo_verification_status === "failed" && reg.elo_verification_reason && (
            <span className="vertigo-badge vertigo-badge-danger">
              {reg.elo_verification_reason}
            </span>
          )}
          {!isEloOk && (
            <span className="vertigo-badge vertigo-badge-danger">Supera ELO cap</span>
          )}
        </div>
      )}

      <div className="vertigo-subtitle">Jugadores</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {players.map((p: any) => (
          <div key={p.id} className="vertigo-info-card">
            <div className="vertigo-info-card-label">
              {p.is_captain ? (
                <>
                  <Crown style={{ width: 11, height: 11, color: "var(--vertigo-purple-soft)" }} />
                  Capitán
                </>
              ) : (
                <>
                  <Star style={{ width: 11, height: 11 }} />
                  Jugador
                </>
              )}
            </div>
            <div className="vertigo-info-card-value flex items-center gap-2">
              {p.display_name}
              {p.is_verified && (
                <Check style={{ width: 13, height: 13, color: "var(--vertigo-success)" }} strokeWidth={2.5} />
              )}
            </div>
            <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">
              {p.country ?? "—"} · #{p.aoe2_profile_id}
              {p.max_rating_rm_1v1 !== null && (
                <span className="text-[var(--vertigo-purple-soft)] ml-2">ELO: {p.max_rating_rm_1v1}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {showActions && (
        <div className="vertigo-action-bar mt-5 pt-4 border-t border-[var(--vertigo-line-soft)]">
          <form action={approveAction!}>
            <button type="submit" className="vertigo-btn vertigo-btn-success">
              <Check style={{ width: 14, height: 14 }} />
              Aprobar
            </button>
          </form>
          <form action={rejectAction!}>
            <button type="submit" className="vertigo-btn vertigo-btn-danger">
              <X style={{ width: 14, height: 14 }} />
              Rechazar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
