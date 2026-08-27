import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { refreshTeamIntelAction } from "@/server/actions/intel";
import { CaptainHeader } from "@/components/captain/captain-header";
import { TeamBannerBg } from "@/components/team/team-banner-bg";
import { MatchCountdown } from "@/components/team/countdown";
import { IntelPanel } from "@/components/team/intel-panel";
import { ComodinesGrid, type ComodinRow } from "@/components/team/comodin-cards";
import {
  buildPlayersIntel,
  getCachedTeamStats,
  type PlayerIntel,
  type PresetMapDef,
} from "@/lib/aoe2/stats-cache";
import { CIV_NAMES } from "@/lib/constants/civs";
import { DISCORD_INVITE_URL } from "@/lib/constants";
import { markRequirementAction } from "@/server/actions/requirements";
import {
  Crown, Users, Calendar, Swords, Shield, Check, ChevronRight,
  Zap, Trophy, RefreshCw, Crosshair, ExternalLink, Play,
  ScanFace, CreditCard, MonitorPlay, MessagesSquare, ListChecks,
  Hourglass, ArrowUpRight,
} from "lucide-react";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MiEquipoPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account")
    .select("id, email, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account) redirect("/login");
  if (account.role === "admin" || account.role === "super_admin") redirect("/admin");
  if (account.role === "caster") redirect("/caster");

  const { data: team } = (await supabase
    .from("team_account")
    .select("id, name, tagline, emblem_id, created_at, emblem:emblem_id (image_url)")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!team) {
    return <NotRegistered />;
  }

  const { data: regs } = (await supabase
    .from("team_registration")
    .select("id, status, elo_freeze_snapshot, elo_verification_status, elo_verification_reason, base_civ_ids, extra_civ_ids, submitted_at, approved_at, tournament_edition_id, anti_smurf_check, payment_confirmed, tutorial_watched, discord_joined")
    .eq("team_account_id", team.id)
    .order("submitted_at", { ascending: false })) as { data: any };

  const latestReg = regs?.[0];
  let edition: any = null;
  let presetMaps: PresetMapDef[] = [];
  let players: any[] = [];
  let upcomingMatch: any = null;
  let upcomingOpponent: { name: string; seed: number | null } | null = null;
  let upcomingRound: string | null = null;
  let pastMatches: any[] = [];
  let comodin: ComodinRow | null = null;

  if (latestReg) {
    if (latestReg.tournament_edition_id) {
      const { data: ed } = (await supabase
        .from("tournament_edition")
        .select("id, name, slug, status, elo_cap, elo_tolerance, handbook_url, preset_version_id")
        .eq("id", latestReg.tournament_edition_id)
        .maybeSingle()) as { data: any };
      edition = ed;

      // Mapas oficiales del torneo (preset activo de la edición)
      if (ed?.preset_version_id) {
        const { data: preset } = (await supabase
          .from("preset_version")
          .select("config")
          .eq("id", ed.preset_version_id)
          .maybeSingle()) as { data: any };
        const modes = preset?.config?.mapModes ?? [];
        presetMaps = modes.map((m: any) => ({ id: m.id ?? "", title: m.title ?? m.id ?? "" }))
          .filter((m: PresetMapDef) => m.id);
      }
    }

    const { data: pd } = (await supabase
      .from("player_registration")
      .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, rating_rm_1v1_current, aoe2_profile_id, is_verified")
      .eq("team_registration_id", latestReg.id)
      .order("is_captain", { ascending: false })) as { data: any };
    players = pd ?? [];

    // Inventario de comodines del equipo
    const { data: inv } = (await supabase
      .from("comodin_inventory")
      .select("reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
      .eq("team_registration_id", latestReg.id)
      .maybeSingle()) as { data: any };
    if (inv) {
      comodin = {
        rerollAvailable: inv.reroll_available ?? 0,
        anularAvailable: inv.anular_available ?? 0,
        elegirRivalAvailable: inv.elegir_rival_available ?? 0,
        invocarProAvailable: inv.invocar_pro_available ?? 0,
      };
    }

    const { data: matches } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, jornada_label, format, team_a_id, team_b_id, round_id")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .in("status", ["scheduled", "open", "in_progress", "comodin_window"])
      .order("scheduled_at_start", { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: any };
    upcomingMatch = matches;

    // Rival y ronda de la próxima partida
    if (upcomingMatch) {
      const oppId = upcomingMatch.team_a_id === latestReg.id ? upcomingMatch.team_b_id : upcomingMatch.team_a_id;
      if (oppId) {
        const { data: opp } = (await supabase
          .from("team_registration")
          .select("seed, team_account:team_account_id ( name )")
          .eq("id", oppId)
          .maybeSingle()) as { data: any };
        if (opp) upcomingOpponent = { name: opp.team_account?.name ?? "—", seed: opp.seed ?? null };
      }
      if (upcomingMatch.round_id) {
        const { data: rnd } = (await supabase
          .from("round")
          .select("name")
          .eq("id", upcomingMatch.round_id)
          .maybeSingle()) as { data: any };
        upcomingRound = rnd?.name ?? null;
      }
    }

    // Historial de partidos del torneo
    const { data: past } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, jornada_label, format, score_a, score_b, winner_team_id, team_a_id, team_b_id, games:match_game (game_mode, player_mode, map)")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(6)) as { data: any };
    pastMatches = past ?? [];
  }

  // Resolver nombres de los rivales (para mostrar "vs NombreDelRival" en vez de "Equipo A/B")
  const rivalIds = new Set<string>();
  for (const m of pastMatches) {
    if (m.team_a_id && m.team_a_id !== latestReg?.id) rivalIds.add(m.team_a_id);
    if (m.team_b_id && m.team_b_id !== latestReg?.id) rivalIds.add(m.team_b_id);
  }
  const rivalNames: Record<string, string> = {};
  if (rivalIds.size > 0) {
    const { data: rivals } = (await supabase
      .from("team_registration")
      .select("id, team_account:team_account_id(name)")
      .in("id", Array.from(rivalIds))) as { data: any };
    for (const r of rivals ?? []) {
      rivalNames[r.id] = r.team_account?.name ?? "Rival";
    }
  }

  // ===== INTEL: cache Companion rm_team × mapas del torneo × pool de civs =====
  let intel: PlayerIntel[] = [];
  if (latestReg && players.length > 0) {
    try {
      const cached = await getCachedTeamStats(
        players.map((p: any) => ({ playerRegistrationId: p.id, aoe2ProfileId: p.aoe2_profile_id })),
        { ensureFresh: true }
      );
      intel = buildPlayersIntel({
        players: players.map((p: any) => ({
          id: p.id,
          displayName: p.display_name,
          isCaptain: !!p.is_captain,
          maxRatingRm1v1: p.max_rating_rm_1v1 ?? null,
          aoe2ProfileId: p.aoe2_profile_id,
        })),
        cached,
        poolCivIds: [...((latestReg.base_civ_ids as string[]) ?? []), ...((latestReg.extra_civ_ids as string[]) ?? [])],
        presetMaps,
      });
    } catch (e) {
      console.error("[mi-equipo] intel falló:", e);
    }
  }

  // Fetch ELO promedio del torneo (para percentile)
  const totalElo = players.reduce((s: number, p: any) => s + (p.max_rating_rm_1v1 ?? 0), 0);
  const { data: allApproved } = (await supabase
    .from("team_registration")
    .select("elo_freeze_snapshot")
    .eq("tournament_edition_id", edition?.id ?? "")
    .eq("status", "approved")) as { data: any };
  const allElos = (allApproved ?? []).map((r: any) => r.elo_freeze_snapshot ?? 0).filter((e: number) => e > 0);
  const tournamentMaxElo = allElos.length > 0 ? Math.max(...allElos) : 0;
  const eloPercentile = tournamentMaxElo > 0 ? Math.round((totalElo / tournamentMaxElo) * 100) : null;

  const eloMax = (edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20);
  const eloPct = Math.min(100, Math.round((totalElo / eloMax) * 100));
  const baseCivs = (latestReg?.base_civ_ids as string[]) ?? [];
  const extraCivs = (latestReg?.extra_civ_ids as string[]) ?? [];
  const status = latestReg?.status ?? "pending";
  const captain = players.find((p: any) => p.is_captain);

  const statusBadge = (() => {
    if (status === "approved") return { cls: "vertigo-badge-success", label: "APROBADO" };
    if (status === "rejected") return { cls: "vertigo-badge-danger", label: "RECHAZADO" };
    return { cls: "vertigo-badge-warning", label: "PENDIENTE" };
  })();

  // Requisitos de inscripción: Anti Smurf, Pago, Tutorial visto y Discord.
  // Anti-smurf y pago los confirma el staff; tutorial y Discord se autogestionan.
  const checklist: {
    ok: boolean;
    icon: typeof ScanFace;
    label: string;
    hint: string;
    action?: { href: string; label: string; external?: boolean };
    mark?: { field: "tutorial_watched" | "discord_joined"; label: string };
  }[] = [
    {
      ok: !!latestReg?.anti_smurf_check,
      icon: ScanFace,
      label: "Anti Smurf Check",
      hint: "El staff verifica los perfiles de AoE2 para prevenir smurfs.",
    },
    {
      ok: !!latestReg?.payment_confirmed,
      icon: CreditCard,
      label: "Pago de equipo",
      hint: "Coordiná el pago con el staff por Discord; ellos lo confirman.",
    },
    {
      ok: !!latestReg?.tutorial_watched,
      icon: MonitorPlay,
      label: "Tutorial de torneo visto",
      hint: "Mirá el tutorial oficial: ruleta, comodines y llaves en 15 min.",
      action: { href: "/tutorial", label: "Ver tutorial" },
      mark: { field: "tutorial_watched", label: "Ya lo vi" },
    },
    {
      ok: !!latestReg?.discord_joined,
      icon: MessagesSquare,
      label: "Unirse al Discord",
      hint: "El Discord oficial es obligatorio: ahí se coordina todo.",
      action: { href: DISCORD_INVITE_URL, label: "Unirme", external: true },
      mark: { field: "discord_joined", label: "Ya me uní" },
    },
  ];
  const completedCount = checklist.filter((c) => c.ok).length;

  // Emblema real del equipo (de la DB), con fallback a los escudos genéricos si no eligió uno
  const emblemUrl = team?.emblem?.image_url ?? (team.id ? `/reinos/reino-${(team.id.charCodeAt(0) % 13) + 1}.webp` : `/reinos/reino-1.webp`);

  const verificationBadge = (() => {
    switch (latestReg?.elo_verification_status) {
      case "verified": return { cls: "vertigo-badge-success", label: "ELO verificado" };
      case "pending": return { cls: "vertigo-badge-warning", label: "ELO pendiente" };
      case "hidden": return { cls: "vertigo-badge-warning", label: "Perfil oculto" };
      case "failed": return { cls: "vertigo-badge-danger", label: "ELO falló" };
      default: return null;
    }
  })();

  return (
    <div className="vertigo-page vertigo-shell">
      <CaptainHeader
        active="reino"
        teamTag={team.tagline ?? undefined}
        teamName={team.name}
        emblemUrl={emblemUrl}
      />

      <main className="vertigo-content vertigo-scroll vertigo-fade-in">

        {/* ===== HERO DEL REINO — castillo de marca + identidad + strip de stats ===== */}
        <div
          className="vertigo-card"
          style={{
            padding: 0, overflow: "hidden", position: "relative",
            marginBottom: "28px", border: "1px solid var(--vertigo-line)",
          }}
        >
          <TeamBannerBg
            emblemUrl={emblemUrl}
            seed={team.id}
            backgroundImage="/landing/castillo-vertigo.webp"
            backgroundVideo="/landing/mi-reino-hero.mp4"
          />
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)",
          }} />

          {/* Identidad */}
          <div className="vertigo-hero-identity" style={{ position: "relative", zIndex: 2, padding: "48px 46px 38px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "26px", minWidth: 0 }}>
              <div style={{
                flex: "none", width: "114px", height: "114px", borderRadius: "24px",
                overflow: "hidden", border: "2px solid rgba(212,175,55,0.55)",
                background: "var(--vertigo-input-bg)",
                boxShadow: "0 0 44px rgba(124,58,237,0.45), 0 8px 24px rgba(0,0,0,0.55)",
              }}>
                <img src={emblemUrl} alt={`Escudo de ${team.name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3.5px", textTransform: "uppercase", color: "var(--vertigo-purple-soft)", marginBottom: "8px" }}>
                  Mi reino
                </div>
                <h1 style={{
                  fontFamily: "Cinzel, serif", fontSize: "clamp(34px, 4.5vw, 56px)",
                  fontWeight: 700, color: "var(--vertigo-text)", lineHeight: 1.05,
                  textShadow: "0 2px 20px rgba(0,0,0,0.7)",
                }}>
                  {team.name}
                </h1>
                {team.tagline && (
                  <p style={{ fontSize: "14px", fontStyle: "italic", color: "rgba(230,215,245,0.8)", marginTop: "8px", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
                    &ldquo;{team.tagline}&rdquo;
                  </p>
                )}
              </div>
            </div>
            {/* Estado + acceso a la ficha pública */}
            <div className="vertigo-hero-actions" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px", flex: "none", flexWrap: "wrap" }}>
              <span className={`vertigo-badge ${statusBadge.cls}`} style={{ fontSize: "12px", padding: "8px 22px", fontWeight: 700, letterSpacing: "2px", flex: "none", whiteSpace: "nowrap" }}>
                {statusBadge.label}
              </span>
              <Link
                href={`/equipos/${latestReg?.id ?? ""}`}
                className="vertigo-btn vertigo-btn-ghost"
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", fontSize: "12px", background: "rgba(7,3,16,0.45)", flex: "none", whiteSpace: "nowrap" }}
              >
                Ver mi ficha pública
                <ArrowUpRight style={{ width: 13, height: 13 }} />
              </Link>
            </div>
          </div>

          {/* Strip de datos del reino, apoyado sobre el borde inferior */}
          <div className="vertigo-hero-strip" style={{
            position: "relative", zIndex: 2,
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            borderTop: "1px solid var(--vertigo-line)",
            background: "rgba(7,3,16,0.66)",
            backdropFilter: "blur(8px)",
          }}>
            {[
              { label: "Elo total", value: totalElo.toLocaleString(), sub: `de ${eloMax.toLocaleString()}` },
              { label: "Capitán", value: captain?.display_name ?? "—", sub: captain ? `ELO ${captain.max_rating_rm_1v1 ?? "?"}` : "Sin asignar" },
              { label: "Jugadores", value: `${players.length} / 3`, sub: "integrantes" },
              { label: "Civs registradas", value: `${baseCivs.length + extraCivs.length}`, sub: "9 base + 3 extra" },
              { label: "Edición", value: edition?.name ?? "—", sub: null },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: "16px 20px",
                borderLeft: i > 0 ? "1px solid var(--vertigo-line-soft)" : "none",
                minWidth: 0,
              }}>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginBottom: "5px", whiteSpace: "nowrap" }}>
                  {s.label}
                </div>
                <div style={{
                  fontFamily: "Cinzel, serif", fontSize: "clamp(13px, 1.3vw, 17px)", fontWeight: 700,
                  color: "var(--vertigo-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {s.value}
                  {s.sub && <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 500, color: "var(--vertigo-faint)", marginLeft: "6px" }}>{s.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== PRÓXIMA PARTIDA — rival + countdown + acceso directo ===== */}
        <div className="vertigo-section" style={{ marginBottom: "24px" }}>
          <div className="vertigo-subtitle">
            <Calendar style={{ width: 14, height: 14 }} />
            Próxima partida
          </div>
          {upcomingMatch ? (
            <Link href={`/partido/${upcomingMatch.id}`} style={{ textDecoration: "none" }}>
              <div
                className="vertigo-link-card"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: "16px", flexWrap: "wrap",
                  padding: "22px 28px",
                  border: "1px solid rgba(124,58,237,0.35)",
                  background: "rgba(124,58,237,0.06)",
                  boxShadow: "0 0 24px rgba(124,58,237,0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "18px", minWidth: 0 }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "12px", flex: "none",
                    background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Zap style={{ width: 24, height: 24, color: "var(--vertigo-purple-soft)" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "Cinzel, serif", fontSize: 15, fontWeight: 700, color: "var(--vertigo-text)" }}>
                        {upcomingRound ?? upcomingMatch.jornada_label ?? "Partido programado"}
                      </span>
                      <MatchCountdown targetIso={(upcomingMatch.scheduled_at_start as string) ?? null} />
                      {upcomingMatch.format && (
                        <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: 10, padding: "3px 10px" }}>
                          {upcomingMatch.format}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--vertigo-gold)", marginTop: "4px" }}>
                      vs {upcomingOpponent?.name ?? "Rival a definir"}
                      {upcomingOpponent?.seed != null && (
                        <span className="vertigo-badge vertigo-badge-warning" style={{ fontSize: 9, marginLeft: 8, verticalAlign: "middle" }}>
                          Seed #{upcomingOpponent.seed}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--vertigo-muted)", marginTop: "3px" }}>
                      {upcomingMatch.scheduled_at_start
                        ? fmt.longDateTime(upcomingMatch.scheduled_at_start)
                        : "Horario a confirmar"}
                    </div>
                  </div>
                </div>
                <ChevronRight style={{ width: 22, height: 22, color: "var(--vertigo-purple-soft)", flex: "none" }} />
              </div>
            </Link>
          ) : (
            <div className="vertigo-card">
              <div style={{ textAlign: "center", padding: "44px 20px", color: "var(--vertigo-faint)" }}>
                <Calendar style={{ width: "44px", height: "44px", margin: "0 auto 16px", display: "block", opacity: 0.35 }} strokeWidth={1} />
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "18px", fontWeight: 600, color: "var(--vertigo-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Sin partidos programados
                </div>
                <p style={{ fontSize: "14px", color: "var(--vertigo-faint)", maxWidth: "400px", margin: "0 auto", lineHeight: 1.6 }}>
                  {status === "approved"
                    ? "Cuando el bracket esté generado, tus partidos van a aparecer acá."
                    : "Tu inscripción está pendiente de aprobación. Una vez aprobada, verás tus partidos acá."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===== COMODINES ===== */}
        {comodin && (
          <div className="vertigo-section" style={{ marginBottom: "32px" }}>
            <div className="vertigo-subtitle">
              <Swords style={{ width: 14, height: 14 }} />
              Mis comodines
            </div>
            <ComodinesGrid comodin={comodin} />
          </div>
        )}

        {/* ===== ELO DEL EQUIPO — panel compacto con los guerreros de marca ===== */}
        <div className="vertigo-card" style={{ position: "relative", overflow: "hidden", padding: "20px 30px", marginBottom: "28px" }}>
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              backgroundImage: "url('/brand/guerreros-3v3.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center 32%",
              opacity: 0.5,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, rgba(7,3,16,0.95) 0%, rgba(7,3,16,0.78) 42%, rgba(7,3,16,0.28) 100%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "26px" }}>
            {/* Número */}
            <div style={{ flex: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span className="vertigo-stat-label" style={{ marginBottom: 0 }}>ELO total del equipo</span>
                {verificationBadge && (
                  <span className={`vertigo-badge ${verificationBadge.cls}`} style={{ fontSize: 9, padding: "2px 9px" }}>
                    {verificationBadge.label}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{
                  fontFamily: "Cinzel, serif", fontSize: "44px", fontWeight: 700, lineHeight: 1,
                  color: eloPct > 90 ? "var(--vertigo-danger)" : eloPct > 70 ? "#fbbf24" : "var(--vertigo-purple-pale)",
                  textShadow: "0 0 32px rgba(124,58,237,0.45)",
                }}>
                  {totalElo.toLocaleString()}
                </span>
                <span style={{ fontSize: "14px", color: "var(--vertigo-faint)" }}>/ {eloMax.toLocaleString()}</span>
              </div>
            </div>

            {/* Capacidad del cap */}
            <div style={{ flex: 1, minWidth: "220px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "7px" }}>
                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)" }}>
                  Capacidad del cap
                </span>
                <span style={{
                  fontSize: "13px", fontWeight: 700,
                  color: eloPct > 90 ? "var(--vertigo-danger)" : eloPct > 70 ? "#fbbf24" : "var(--vertigo-purple-pale)",
                }}>
                  {eloPct}%
                </span>
              </div>
              <div style={{ height: "10px", background: "rgba(255,255,255,0.07)", borderRadius: "5px", overflow: "hidden", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)" }}>
                <div style={{
                  height: "100%", width: `${eloPct}%`, borderRadius: "5px",
                  background: eloPct > 90 ? "linear-gradient(90deg, #fb7185, #e11d48)" : eloPct > 70 ? "linear-gradient(90deg, #fbbf24, #f59e0b)" : "linear-gradient(90deg, var(--vertigo-purple), var(--vertigo-purple-soft))",
                  boxShadow: "0 0 14px rgba(124,58,237,0.5)",
                  transition: "width 1s ease",
                }} />
              </div>
            </div>

            {/* Percentil */}
            {eloPercentile !== null && eloPercentile !== undefined && (
              <div className="vertigo-elo-percentil" style={{ flex: "none", textAlign: "right", borderLeft: "1px solid var(--vertigo-line-soft)", paddingLeft: "26px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginBottom: "5px" }}>
                  Percentil del torneo
                </div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "22px", fontWeight: 700, lineHeight: 1, color: eloPercentile >= 80 ? "var(--vertigo-gold)" : "var(--vertigo-purple-pale)" }}>
                  Top {100 - eloPercentile}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== REQUISITOS DE INSCRIPCIÓN — una tarjeta por requisito ===== */}
        <div className="vertigo-section" style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px", flexWrap: "wrap" }}>
            <div className="vertigo-subtitle" style={{ margin: 0 }}>
              <ListChecks style={{ width: 14, height: 14 }} />
              Requisitos de inscripción
            </div>
            <div style={{ flex: 1, minWidth: "110px", height: "6px", background: "rgba(255,255,255,0.07)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${(completedCount / checklist.length) * 100}%`, borderRadius: "3px",
                background: completedCount === checklist.length ? "linear-gradient(90deg, var(--vertigo-success), #4ade80)" : "linear-gradient(90deg, var(--vertigo-purple), var(--vertigo-purple-soft))",
                transition: "width 1s ease",
              }} />
            </div>
            <span className={`vertigo-badge ${completedCount === checklist.length ? "vertigo-badge-success" : "vertigo-badge-purple"}`} style={{ fontSize: 10 }}>
              {completedCount}/{checklist.length}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
            {checklist.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "18px", borderRadius: "14px",
                  border: `1px solid ${item.ok ? "rgba(34,197,94,0.35)" : "var(--vertigo-line)"}`,
                  background: item.ok ? "rgba(34,197,94,0.05)" : "rgba(13,9,19,0.6)",
                  boxShadow: item.ok ? "0 0 20px rgba(34,197,94,0.08)" : "0 2px 10px rgba(0,0,0,0.25)",
                  display: "flex", flexDirection: "column", gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "11px", flex: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: item.ok ? "rgba(34,197,94,0.12)" : "rgba(124,58,237,0.12)",
                    border: `1px solid ${item.ok ? "rgba(34,197,94,0.35)" : "rgba(124,58,237,0.3)"}`,
                    color: item.ok ? "var(--vertigo-success)" : "var(--vertigo-purple-soft)",
                  }}>
                    <item.icon style={{ width: 18, height: 18 }} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--vertigo-text)", lineHeight: 1.25 }}>
                    {item.label}
                  </div>
                  {item.ok && (
                    <Check style={{ width: 15, height: 15, color: "var(--vertigo-success)", marginLeft: "auto", flex: "none" }} strokeWidth={2.5} />
                  )}
                </div>
                <p style={{ fontSize: "11.5px", color: "var(--vertigo-faint)", lineHeight: 1.5, margin: 0, flex: 1 }}>
                  {item.hint}
                </p>
                {item.ok ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start", padding: "5px 12px", borderRadius: "999px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", fontSize: "10.5px", fontWeight: 700, color: "var(--vertigo-success)" }}>
                    Confirmado
                  </div>
                ) : item.mark && item.action ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <a
                      href={item.action.href}
                      target={item.action.external ? "_blank" : undefined}
                      rel={item.action.external ? "noopener noreferrer" : undefined}
                      className="vertigo-btn vertigo-btn-primary"
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 10px", fontSize: 10.5, whiteSpace: "nowrap" }}
                    >
                      {item.action.external ? <ExternalLink style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
                      {item.action.label}
                    </a>
                    <form action={markRequirementAction} style={{ flex: 1 }}>
                      <input type="hidden" name="field" value={item.mark.field} />
                      <input type="hidden" name="registrationId" value={latestReg?.id ?? ""} />
                      <button
                        type="submit"
                        className="vertigo-btn vertigo-btn-ghost"
                        style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 10px", fontSize: 10.5, whiteSpace: "nowrap" }}
                      >
                        <Check style={{ width: 12, height: 12 }} />
                        {item.mark.label}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start", padding: "5px 12px", borderRadius: "999px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", fontSize: "10.5px", fontWeight: 700, color: "var(--vertigo-warning)" }}>
                    <Hourglass style={{ width: 12, height: 12 }} />
                    Pendiente
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ===== INTEL DEL EQUIPO (mapas del torneo × pool × compañeros) ===== */}
        {intel.length > 0 && (
          <IntelPanel
            intel={intel}
            footer={
              <form action={refreshTeamIntelAction} style={{ marginLeft: "auto", marginRight: "auto" }}>
                <input type="hidden" name="registrationId" value={latestReg?.id ?? ""} />
                <button
                  type="submit"
                  className="vertigo-btn vertigo-btn-ghost"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: 10 }}
                >
                  <RefreshCw style={{ width: 11, height: 11 }} />
                  Actualizar
                </button>
              </form>
            }
          />
        )}

        {/* ===== JUGADORES + POOL DE CIVS ===== */}
        <div className="vertigo-grid-2" style={{ marginBottom: "32px" }}>

          {/* JUGADORES */}
          <div className="vertigo-section">
            <div className="vertigo-subtitle">
              <Users style={{ width: 14, height: 14 }} />
              Jugadores
              <span className="vertigo-badge vertigo-badge-purple" style={{ marginLeft: "auto" }}>{players.length} / 3</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {players.map((p) => {
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "16px",
                      padding: "18px 20px", borderRadius: "14px",
                      border: `1px solid ${p.is_captain ? "rgba(124,58,237,0.4)" : "var(--vertigo-line)"}`,
                      background: p.is_captain ? "rgba(124,58,237,0.08)" : "rgba(13,9,19,0.6)",
                      boxShadow: p.is_captain ? "0 0 24px rgba(124,58,237,0.15)" : "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ position: "relative", flex: "none" }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "Cinzel, serif", fontSize: "24px", fontWeight: 700,
                        border: `2px solid ${p.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                        color: p.is_captain ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
                        background: p.is_captain ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                        boxShadow: p.is_captain ? "0 0 16px rgba(124,58,237,0.2)" : "none",
                      }}>
                        {p.display_name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      {p.max_rating_rm_1v1 != null && p.max_rating_rm_1v1 > 0 && (
                        <div style={{
                          position: "absolute", bottom: "-4px", right: "-4px",
                          background: "rgba(124,58,237,0.95)", border: "1.5px solid var(--vertigo-purple)",
                          borderRadius: "999px", padding: "2px 7px",
                          fontSize: "9px", fontWeight: 700, color: "#fff", fontFamily: "Cinzel, serif",
                          boxShadow: "0 2px 8px rgba(124,58,237,0.4)",
                        }}>
                          {p.max_rating_rm_1v1}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--vertigo-text)" }}>{p.display_name}</span>
                        {p.is_captain && <Crown style={{ width: 14, height: 14, color: "var(--vertigo-purple-soft)" }} />}
                        {p.is_verified && (
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "999px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "var(--vertigo-success)", fontWeight: 700 }}>
                            ✓
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--vertigo-faint)", marginTop: "4px" }}>
                        {p.country || "?"}
                        {p.clan && ` · ${p.clan}`}
                        {p.is_captain && " · Capitán"}
                      </div>
                    </div>

                    {/* ELO + Forma */}
                    <div style={{ textAlign: "right", flex: "none" }}>
                      {p.max_rating_rm_1v1 != null && p.max_rating_rm_1v1 > 0 && (
                        <>
                          <div style={{ fontFamily: "Cinzel, serif", fontSize: "26px", fontWeight: 700, lineHeight: 1, color: "var(--vertigo-purple-soft)" }}>
                            {p.max_rating_rm_1v1.toLocaleString()}
                          </div>
                          <div style={{ fontSize: "9px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginTop: "4px" }}>
                            ELO máx
                          </div>
                          {/* Forma = current/max */}
                          {p.rating_rm_1v1_current && p.max_rating_rm_1v1 && (() => {
                            const formIndex = p.rating_rm_1v1_current / p.max_rating_rm_1v1;
                            const color = formIndex >= 0.95 ? "var(--vertigo-success)" : formIndex >= 0.85 ? "var(--vertigo-warning)" : "var(--vertigo-danger)";
                            const pct = Math.round(formIndex * 100);
                            return (
                              <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                                <div style={{ fontSize: "10px", fontWeight: 700, color, letterSpacing: "1px" }}>
                                  {pct >= 95 ? "🔥 Racha" : pct >= 85 ? "⚡ En forma" : "📉 Bajando"}
                                </div>
                                <div style={{ display: "flex", gap: "6px", fontSize: "10px", color: "var(--vertigo-faint)" }}>
                                  <span>{p.rating_rm_1v1_current} now</span>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* POOL DE CIVS */}
          <div className="vertigo-section">
            <div className="vertigo-subtitle">
              <Swords style={{ width: 14, height: 14 }} />
              Mi pool de civs
              <span className="vertigo-badge vertigo-badge-purple" style={{ marginLeft: "auto" }}>{baseCivs.length + extraCivs.length} / 12</span>
            </div>
            <div className="vertigo-card" style={{ padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: "8px" }}>
                {[...baseCivs, ...extraCivs].map((civId, idx) => {
                  const isExtra = idx >= baseCivs.length;
                  return (
                    <div
                      key={civId}
                      title={CIV_NAMES[civId] ?? civId}
                      style={{
                        position: "relative",
                        opacity: isExtra ? 0.55 : 1,
                        transition: "transform 0.2s ease",
                        cursor: "default",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          paddingBottom: "100%", // aspect-ratio 1:1 via padding trick
                          position: "relative",
                          borderRadius: "10px",
                          overflow: "hidden",
                          border: `2px solid ${isExtra ? "var(--vertigo-line)" : "rgba(124,58,237,0.4)"}`,
                          background: "var(--vertigo-input-bg)",
                          boxShadow: isExtra ? "none" : "0 0 12px rgba(124,58,237,0.15)",
                        }}
                      >
                        <img
                          src={`/civs/${civId}.webp`}
                          alt={CIV_NAMES[civId] ?? civId}
                          style={{
                            position: "absolute", inset: 0, width: "100%", height: "100%",
                            objectFit: "cover",
                          }}
                        />
                        {/* Overlay gradiente en la parte inferior */}
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          height: "40%",
                          background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.7))",
                        }} />
                      </div>
                      {isExtra && (
                        <div style={{
                          position: "absolute", bottom: "4px", left: "0", right: "0",
                          textAlign: "center", fontSize: "7px", fontWeight: 700,
                          letterSpacing: "1px", textTransform: "uppercase", color: "var(--vertigo-faint)",
                          zIndex: 2,
                        }}>
                          Extra
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Nombres debajo */}
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--vertigo-line-soft)", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {baseCivs.map((civId) => (
                  <span key={civId} style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                    {CIV_NAMES[civId] ?? civId}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== HISTORIAL DEL TORNEO ===== */}
        {pastMatches.length > 0 && (
          <div className="vertigo-section">
            <div className="vertigo-subtitle">
              <Trophy style={{ width: 14, height: 14 }} />
              Historial del torneo
            </div>
            <div className="vertigo-card" style={{ padding: 0, overflow: "hidden" }}>
              {pastMatches.map((m, idx) => {
                const isTeamA = m.team_a_id === latestReg?.id;
                const won = m.winner_team_id === latestReg?.id;
                const ourScore = isTeamA ? m.score_a : m.score_b;
                const theirScore = isTeamA ? m.score_b : m.score_a;
                const rivalId = isTeamA ? m.team_b_id : m.team_a_id;
                const rivalName = (rivalId && rivalNames[rivalId]) || "Rival";
                // Obtener datos del sorteo si existe
                const gameData = m.games?.[0];
                const sorteoInfo = gameData
                  ? [gameData.game_mode, gameData.player_mode?.toUpperCase(), gameData.map].filter(Boolean).join(" · ")
                  : null;
                return (
                  <Link key={m.id} href={`/partido/${m.id}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: "16px",
                        padding: "16px 24px",
                        borderBottom: idx < pastMatches.length - 1 ? "1px solid var(--vertigo-line-soft)" : "none",
                        transition: "background 0.2s ease",
                      }}
                    >
                      {/* Indicador resultado */}
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "8px", flex: "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: won ? "rgba(34,197,94,0.12)" : "rgba(251,113,133,0.1)",
                        border: `1.5px solid ${won ? "rgba(34,197,94,0.35)" : "rgba(251,113,133,0.3)"}`,
                        fontFamily: "Cinzel, serif", fontSize: "16px", fontWeight: 700,
                        color: won ? "var(--vertigo-success)" : "var(--vertigo-danger)",
                      }}>
                        {won ? "V" : "D"}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--vertigo-text)" }}>
                          vs {rivalName}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--vertigo-faint)", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span>{m.jornada_label ?? "Partido"}</span>
                          {sorteoInfo && (
                            <span style={{ color: "var(--vertigo-muted)", fontSize: "11px" }}>· {sorteoInfo}</span>
                          )}
                          {m.format && (
                            <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: "9px", padding: "2px 8px" }}>
                              {m.format}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Score */}
                      <div style={{
                        fontFamily: "Cinzel, serif", fontSize: "20px", fontWeight: 700,
                        color: won ? "var(--vertigo-success)" : "var(--vertigo-danger)",
                        flex: "none",
                      }}>
                        {ourScore}–{theirScore}
                      </div>
                      <ChevronRight style={{ width: 16, height: 16, color: "var(--vertigo-faint)", flex: "none" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Nota de fuente de datos externos */}
        {(intel.length > 0 || edition?.handbook_url) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "var(--vertigo-faint)", marginBottom: 8 }}>
            <Crosshair style={{ width: 11, height: 11 }} />
            Stats de ladder vía AoE2 Companion · partidas de equipos · se actualizan al aprobar la inscripción y cada 7 días.
          </div>
        )}

      </main>
    </div>
  );
}

function NotRegistered() {
  return (
    <div className="vertigo-page vertigo-shell">
      <main className="vertigo-content vertigo-scroll vertigo-fade-in">
        <div className="vertigo-page-title">
          <span className="vertigo-kicker">MI REINO</span>
          <h1 className="vertigo-title">Sin reino</h1>
        </div>
        <div className="vertigo-card" style={{ textAlign: "center", padding: "80px 24px", maxWidth: "560px", margin: "0 auto" }}>
          <Shield style={{ width: 72, height: 72, color: "var(--vertigo-faint)", margin: "0 auto 20px", display: "block", opacity: 0.3 }} strokeWidth={1} />
          <div style={{ fontFamily: "Cinzel, serif", fontSize: "22px", fontWeight: 600, color: "var(--vertigo-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1.5px" }}>
            No tenés reino todavía
          </div>
          <p style={{ fontSize: "15px", color: "var(--vertigo-faint)", maxWidth: "420px", margin: "0 auto 32px", lineHeight: 1.6 }}>
            Para acceder a esta página necesitás inscribir primero tu reino en el torneo.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
            <Link href="/registro">
              <button className="vertigo-btn vertigo-btn-primary" style={{ padding: "16px 40px", fontSize: "13px" }}>
                Inscribir mi reino →
              </button>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "12px 24px", fontSize: "11px" }}>
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
