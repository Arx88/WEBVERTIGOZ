import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Crown, Users, Calendar, Swords, ChevronRight, LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

export default async function MiEquipoPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accountData } = (await supabase
    .from("account")
    .select("id, email, role, display_name, avatar_key")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (accountData?.role === "admin" || accountData?.role === "super_admin") {
    redirect("/admin");
  }
  if (accountData?.role === "caster") {
    redirect("/caster");
  }

  const { data: teamAccount } = (await supabase
    .from("team_account")
    .select("id, name, tagline, emblem_id, created_at")
    .eq("owner_id", accountData?.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!teamAccount) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24 bg-bg">
        <div className="text-center max-w-md flex flex-col items-center gap-6">
          <div className="label-premium text-gold/80">MI EQUIPO</div>
          <h1 className="font-serif text-4xl">No tenés equipo todavía</h1>
          <p className="text-text-secondary text-sm font-light">
            Para acceder a esta página necesitás inscribir primero tu equipo en el torneo.
          </p>
          <Button asChild variant="premium" size="lg">
            <Link href="/registro">Inscribir mi equipo</Link>
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const { data: registrations } = await supabase
    .from("team_registration")
    .select(`
      id,
      status,
      elo_freeze_snapshot,
      elo_verification_status,
      base_civ_ids,
      extra_civ_ids,
      submitted_at,
      approved_at,
      tournament_edition:slug,
      tournament_edition:name,
      tournament_edition:status,
      tournament_edition:elo_cap,
      tournament_edition:elo_tolerance
    `)
    .eq("team_account_id", teamAccount.id)
    .order("submitted_at", { ascending: false });

  let players: any[] = [];
  if (registrations && registrations.length > 0) {
    const { data: playerData } = (await supabase
      .from("player_registration")
      .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, rating_rm_1v1_current, aoe2_profile_id, is_verified")
      .eq("team_registration_id", (registrations[0] as any).id)
      .order("is_captain", { ascending: false })) as { data: any };
    players = playerData ?? [];
  }

  const latestReg = registrations?.[0] as any;
  const edition = latestReg?.tournament_edition as any;
  const totalElo = players.reduce((sum: number, p: any) => sum + (p.max_rating_rm_1v1 ?? 0), 0);

  return (
    <main className="min-h-screen bg-bg">
      <header className="border-b border-border-subtle">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border border-gold/60 rotate-45 flex items-center justify-center">
              <span className="-rotate-45 font-serif text-gold text-sm font-bold">V</span>
            </div>
            <div>
              <div className="font-serif text-lg">VÉRTIGO · Mi Equipo</div>
              <div className="text-caption text-text-tertiary uppercase tracking-wider">
                {user.email}
              </div>
            </div>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="w-4 h-4" />
              Salir
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="label-premium text-gold/80 mb-2">EQUIPO</div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full border-2 border-gold/60 flex items-center justify-center text-gold shrink-0">
                  <Shield className="w-10 h-10" strokeWidth={1.25} />
                </div>
                <div>
                  <CardTitle className="text-3xl">{teamAccount.name}</CardTitle>
                  {teamAccount.tagline && (
                    <p className="text-text-secondary italic mt-1">&ldquo;{teamAccount.tagline}&rdquo;</p>
                  )}
                </div>
              </div>
              {latestReg && (
                <Badge variant={latestReg.status === "approved" ? "success" : latestReg.status === "rejected" ? "danger" : "warning"}>
                  {latestReg.status === "approved" ? "APROBADO" : latestReg.status === "rejected" ? "RECHAZADO" : "PENDIENTE"}
                </Badge>
              )}
            </div>
          </CardHeader>
          {latestReg && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border-subtle">
                <div>
                  <div className="label-premium text-text-tertiary mb-1">ELO TOTAL</div>
                  <div className="font-serif text-2xl text-gold tabular-nums">{totalElo}</div>
                  <div className="text-caption text-text-tertiary">/ {(edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20)}</div>
                </div>
                <div>
                  <div className="label-premium text-text-tertiary mb-1">VERIFICACIÓN</div>
                  <div className="text-sm">
                    {latestReg.elo_verification_status === "verified" ? "✓ Verificado" : latestReg.elo_verification_status === "hidden" ? "Falta verificar" : latestReg.elo_verification_status === "failed" ? "Falló" : "Pendiente"}
                  </div>
                </div>
                <div>
                  <div className="label-premium text-text-tertiary mb-1">EDICIÓN</div>
                  <div className="text-sm">{edition?.name ?? "—"}</div>
                </div>
                <div>
                  <div className="label-premium text-text-tertiary mb-1">ENVIADO</div>
                  <div className="text-sm">
                    {latestReg.submitted_at
                      ? new Date(latestReg.submitted_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-gold/60" strokeWidth={1.5} />
                Jugadores
              </CardTitle>
              <span className="text-caption text-text-tertiary">{players.length} de 3</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {players.map((p: any, idx: number) => (
                <div key={p.id} className="border border-border-subtle p-4 flex flex-col items-center text-center">
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-3 ${p.is_captain ? "border-gold text-gold" : "border-border-strong text-text-secondary"}`}>
                    {p.is_captain ? <Crown className="w-6 h-6" strokeWidth={1.5} /> : <span className="font-serif">{idx + 1}</span>}
                  </div>
                  <div className="font-medium text-sm mb-1">{p.display_name}</div>
                  <div className="flex items-center gap-2 text-caption text-text-tertiary mb-2">
                    {p.country && <span>{p.country}</span>}
                    {p.clan && <span>· {p.clan}</span>}
                  </div>
                  {p.max_rating_rm_1v1 !== null && (
                    <div className="text-caption text-text-secondary">
                      ELO máx: <span className="text-gold tabular-nums">{p.max_rating_rm_1v1}</span>
                    </div>
                  )}
                  {p.is_captain && (
                    <Badge variant="gold" size="sm" className="mt-2">
                      <Crown className="w-2.5 h-2.5 mr-1" strokeWidth={1.5} />
                      Capitán
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {latestReg && Array.isArray(latestReg.base_civ_ids) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Swords className="w-5 h-5 text-gold/60" strokeWidth={1.5} />
                Civilizaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="label-premium text-text-tertiary mb-2">CIVS BASE (9)</div>
                <div className="flex flex-wrap gap-2">
                  {(latestReg.base_civ_ids as string[]).map((civId: string, idx: number) => (
                    <Badge key={civId} variant="gold">
                      <span className="tabular-nums mr-1">{idx + 1}.</span>
                      {civId}
                    </Badge>
                  ))}
                </div>
              </div>
              {Array.isArray(latestReg.extra_civ_ids) && (latestReg.extra_civ_ids as string[]).length > 0 && (
                <div>
                  <div className="label-premium text-text-tertiary mb-2">CIVS EXTRA (3 — para finalistas)</div>
                  <div className="flex flex-wrap gap-2">
                    {(latestReg.extra_civ_ids as string[]).map((civId: string, idx: number) => (
                      <Badge key={civId} variant="outline">
                        <span className="tabular-nums mr-1">{idx + 1}.</span>
                        {civId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold/60" strokeWidth={1.5} />
              Próximos partidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-text-secondary text-sm font-light mb-4">
                {latestReg?.status === "approved"
                  ? "No tenés partidos programados aún. Cuando el bracket esté generado, van a aparecer acá."
                  : "Tu inscripción está pendiente de aprobación. Una vez aprobada, podrás ver tus partidos acá."}
              </p>
              {latestReg?.status === "approved" && (
                <Button asChild variant="outline">
                  <Link href="/torneo">
                    Ver bracket completo
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
