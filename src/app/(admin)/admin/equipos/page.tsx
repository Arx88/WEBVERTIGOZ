import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Check, X, Users, AlertTriangle, LogOut } from "lucide-react";
import { logoutAction, approveTeamAction, rejectTeamAction } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

export default async function AdminEquiposPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accountData } = (await supabase
    .from("account")
    .select("id, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) {
    redirect("/mi-equipo");
  }

  const { data: registrations } = (await supabase
    .from("team_registration")
    .select(`
      id,
      status,
      elo_freeze_snapshot,
      elo_verification_status,
      elo_verification_reason,
      submitted_at,
      approved_at,
      team_account:team_account_id (
        id, name, tagline, emblem_id
      ),
      tournament_edition:tournament_edition_id (
        name, elo_cap, elo_tolerance
      )
    `)
    .order("submitted_at", { ascending: false })) as { data: any };

  const registrationsWithPlayers = await Promise.all(
    (registrations ?? []).map(async (reg: any) => {
      const { data: players } = await supabase
        .from("player_registration")
        .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, is_verified, aoe2_profile_id")
        .eq("team_registration_id", reg.id)
        .order("is_captain", { ascending: false });
      return { ...reg, players: players ?? [] };
    })
  );

  const pending = registrationsWithPlayers.filter((r: any) => r.status === "pending");
  const approved = registrationsWithPlayers.filter((r: any) => r.status === "approved");
  const rejected = registrationsWithPlayers.filter((r: any) => r.status === "rejected");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-premium text-gold/80 mb-2">INSCRIPCIONES</div>
          <h1 className="font-serif text-4xl">Equipos</h1>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="w-4 h-4" />
            Salir
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="label-premium text-text-tertiary">TOTAL</div>
            <div className="font-serif text-3xl text-text-primary mt-1 tabular-nums">{registrationsWithPlayers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="label-premium text-warning/80">PENDIENTES</div>
            <div className="font-serif text-3xl text-warning mt-1 tabular-nums">{pending.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="label-premium text-success/80">APROBADOS</div>
            <div className="font-serif text-3xl text-success mt-1 tabular-nums">{approved.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="label-premium text-danger/80">RECHAZADOS</div>
            <div className="font-serif text-3xl text-danger mt-1 tabular-nums">{rejected.length}</div>
          </CardContent>
        </Card>
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning/80" strokeWidth={1.5} />
              Pendientes de aprobación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((reg: any) => (
              <TeamCard key={reg.id} reg={reg} showActions={true} approveAction={approveTeamAction.bind(null, reg.id)} rejectAction={rejectTeamAction.bind(null, reg.id)} />
            ))}
          </CardContent>
        </Card>
      )}

      {approved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Check className="w-5 h-5 text-success/80" strokeWidth={1.5} />
              Aprobados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {approved.map((reg: any) => (
              <TeamCard key={reg.id} reg={reg} showActions={false} />
            ))}
          </CardContent>
        </Card>
      )}

      {rejected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <X className="w-5 h-5 text-danger/80" strokeWidth={1.5} />
              Rechazados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rejected.map((reg: any) => (
              <TeamCard key={reg.id} reg={reg} showActions={false} />
            ))}
          </CardContent>
        </Card>
      )}

      {registrationsWithPlayers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-text-tertiary mx-auto mb-4" strokeWidth={1} />
            <p className="text-text-secondary text-sm font-light">
              Todavía no hay equipos inscriptos. Cuando empiecen a registrarse, vas a verlos acá.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamCard({ reg, showActions, approveAction, rejectAction }: {
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

  return (
    <div className="border border-border-subtle bg-bg-elevated p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border border-gold/60 flex items-center justify-center text-gold shrink-0">
            <Shield className="w-6 h-6" strokeWidth={1.25} />
          </div>
          <div>
            <div className="font-serif text-lg">{team?.name ?? "—"}</div>
            {team?.tagline && <div className="text-text-secondary text-sm italic">&ldquo;{team.tagline}&rdquo;</div>}
            <div className="text-caption text-text-tertiary mt-1">
              {edition?.name ?? "—"} · Enviado {reg.submitted_at ? new Date(reg.submitted_at).toLocaleDateString("es-AR") : "—"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-caption text-text-tertiary uppercase tracking-wider mb-1">ELO TOTAL</div>
          <div className={`font-serif text-2xl tabular-nums ${isEloOk ? "text-gold" : "text-danger"}`}>
            {reg.elo_freeze_snapshot ?? "—"}
          </div>
          <div className="text-caption text-text-tertiary">/ {eloCap}</div>
        </div>
      </div>

      {reg.elo_verification_status === "pending" && (
        <div className="mt-3 p-2 border border-warning/40 bg-warning/5 text-warning text-xs">
          ⚠ Falta verificación de ELO — al menos un jugador tiene el perfil oculto en AoE2 Companion
        </div>
      )}
      {reg.elo_verification_status === "failed" && (
        <div className="mt-3 p-2 border border-danger/40 bg-danger/5 text-danger text-xs">
          ✗ Falló la verificación de ELO — {reg.elo_verification_reason ?? "Error desconocido"}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border-subtle">
        <div className="label-premium text-text-tertiary mb-2 flex items-center gap-2">
          <Users className="w-3 h-3" strokeWidth={1.5} />
          JUGADORES ({players.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {players.map((p: any) => (
            <div key={p.id} className="border border-border-subtle p-2 text-xs">
              <div className="font-medium flex items-center gap-1">
                {p.is_captain && <span className="text-gold">★</span>}
                {p.display_name}
              </div>
              <div className="text-text-tertiary">
                {p.country} · #{p.aoe2_profile_id}
                {p.max_rating_rm_1v1 !== null && (
                  <span className="ml-2">ELO: <span className="text-gold tabular-nums">{p.max_rating_rm_1v1}</span></span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showActions && (
        <div className="mt-3 pt-3 border-t border-border-subtle flex gap-2">
          <form action={approveAction!}>
            <Button type="submit" variant="success" size="sm">
              <Check className="w-4 h-4" />
              Aprobar
            </Button>
          </form>
          <form action={rejectAction!}>
            <Button type="submit" variant="danger" size="sm">
              <X className="w-4 h-4" />
              Rechazar
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
