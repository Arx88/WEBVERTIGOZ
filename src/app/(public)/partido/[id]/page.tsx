import Link from "next/link";
import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { enforceMatchIfDue } from "@/server/match-enforcement";
import { loadMatch } from "./match-data";
import MatchRealtimeWrapper from "./match-realtime-wrapper";
import VertigoFooter from "@/components/shared/vertigo-footer";
import SiteNav from "@/components/nav/site-nav";

export const dynamic = "force-dynamic";

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Chequeo lazy de la ventana de W.O. (sin auto-resolución):
  // cargar los datos así la página refleja el resultado real.
  try {
    await enforceMatchIfDue(id);
  } catch {
    // best-effort: el cron lo cubre si esto falla
  }

  const supabase = await getSupabaseServer();

  // Datos del partido + contexto del capitán + contexto del espectador
  // + contexto de visualización pública (rosters/pozo para el scoreboard)
  // corren EN PARALELO.
  const [initialMatch, captainContext, spectatorContext, viewContext] = await Promise.all([
    loadMatch(supabase, id).catch(() => null),
    resolveCaptainContext(supabase as any, id).catch(() => null),
    resolveSpectatorContext(supabase as any, id).catch(() => null),
    resolveViewContext(supabase as any, id).catch(() => null),
  ]);

  if (!initialMatch) {
    // Si no encontramos el match, mostramos un estado "no encontrado" con el diseño.
    return (
      <div className="vertigo-page vertigo-shell vertigo-fade-in">
        <SiteNav />
        <main className="vertigo-content">
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Swords
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Partido no encontrado</div>
              <p className="vertigo-empty-desc">
                El partido puede haber sido cancelado, no existe, o todavía no fue generado por
                el bracket.
              </p>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
              ← Volver a resultados
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <SiteNav />

      <main className="vertigo-content">
        <MatchRealtimeWrapper matchId={id} initialMatch={initialMatch} captainContext={captainContext} spectatorContext={spectatorContext} viewContext={viewContext} />

        <div className="mt-6">
          <VertigoFooter />
        </div>
      </main>
    </div>
  );
}

// ============================================================
// Resolver el contexto del capitán (server-side)
// ============================================================
// Devuelve todo lo que necesita el CaptainMatchPanel para renderizar la vista
// contextual del capitán en su partido (lineup, READY, comodines).

import { getSupabaseServiceRole } from "@/lib/supabase/server";

async function resolveCaptainContext(supabase: any, matchId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase.from("account").select("id, role").eq("supabase_auth_id", user.id).single();
  if (!account) return null;

  // team del usuario
  const { data: teamAccount } = await supabase
    .from("team_account").select("id, name").eq("owner_id", account.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!teamAccount) return null;

  // team_registration del usuario en la edición de este match
  const { data: matchRow } = await supabase
    .from("match")
    .select("id, team_a_id, team_b_id, round:round_id(bracket:bracket_id(tournament_edition_id))")
    .eq("id", matchId).single();
  if (!matchRow) return null;
  const editionId = matchRow.round?.bracket?.tournament_edition_id;

  const { data: myReg } = await supabase
    .from("team_registration")
    .select("id, team_account_id")
    .eq("team_account_id", teamAccount.id)
    .eq("tournament_edition_id", editionId)
    .maybeSingle();
  if (!myReg) return null;

  // ¿el usuario es capitán de un equipo de this match?
  const isTeamA = matchRow.team_a_id === myReg.id;
  const isTeamB = matchRow.team_b_id === myReg.id;
  if (!isTeamA && !isTeamB) return null;

  // Roster (3 jugadores)
  const { data: players } = await supabase
    .from("player_registration")
    .select("id, display_name, is_captain")
    .eq("team_registration_id", myReg.id);

  // Roster del RIVAL (targets de ANULAR / ELEGIR RIVAL)
  const rivalRegId = isTeamA ? matchRow.team_b_id : matchRow.team_a_id;
  let rivalPlayers: { id: string; display_name: string; is_captain: boolean }[] = [];
  if (rivalRegId) {
    const { data: rps } = await supabase
      .from("player_registration")
      .select("id, display_name, is_captain")
      .eq("team_registration_id", rivalRegId);
    rivalPlayers = (rps ?? []).map((p: any) => ({ id: p.id, display_name: p.display_name, is_captain: p.is_captain }));
  }

  // Jugadores anulados en este match (por comodín ANULAR)
  const service = getSupabaseServiceRole();
  const { data: usages } = await service
    .from("comodin_usage")
    .select("target_player_id")
    .eq("match_id", matchId)
    .eq("comodin_type", "anular")
    .eq("status", "executed");
  const annulledAll = (usages ?? []).map((u: any) => u.target_player_id).filter(Boolean) as string[];
  const myPlayerIds = new Set((players ?? []).map((p: any) => p.id));
  const annulledPlayerIds = annulledAll.filter((id) => myPlayerIds.has(id));
  const rivalAnnulledPlayerIds = annulledAll.filter((id) => !myPlayerIds.has(id));

  // Inventario de comodines del capitán (usos restantes por tipo) para la
  // grilla de la ventana de comodines. Service role: RLS de participación.
  const { data: inv } = await service
    .from("comodin_inventory")
    .select("reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
    .eq("team_registration_id", myReg.id)
    .maybeSingle();
  const comodinInventory = inv
    ? {
        reroll: (inv.reroll_available ?? 0) as number,
        anular: (inv.anular_available ?? 0) as number,
        elegirRival: (inv.elegir_rival_available ?? 0) as number,
        invocarPro: (inv.invocar_pro_available ?? 0) as number,
      }
    : { reroll: 0, anular: 0, elegirRival: 0, invocarPro: 0 };

  return {
    myTeamRegId: myReg.id,
    teamA_id: matchRow.team_a_id,
    teamB_id: matchRow.team_b_id,
    myPlayers: (players ?? []).map((p: any) => ({ id: p.id, display_name: p.display_name, is_captain: p.is_captain })),
    rivalPlayers,
    annulledPlayerIds,
    rivalAnnulledPlayerIds,
    comodinInventory,
  };
}

// ============================================================
// Resolver el contexto del espectador (server-side)
// ============================================================
// Devuelve lo que necesita el BetPanel: rol del viewer, saldo del wallet,
// su apuesta en este match y los agregados del pozo (pool/stake por equipo).
// Los agregados se calculan con service role porque las bets son privadas.

async function resolveSpectatorContext(supabase: any, matchId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "anonymous" } as const;

  const { data: account } = await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).maybeSingle();
  if (!account) return { kind: "anonymous" } as const;
  if (account.role !== "spectator") return { kind: "other-role" } as const;

  const service = getSupabaseServiceRole();

  // Saldo del wallet propio
  const { data: wallet } = await service
    .from("spectator_wallet").select("balance").eq("account_id", account.id).maybeSingle();

  // Apuesta propia en este match
  const { data: myBetRow } = await service
    .from("bet").select("id, picked_team_id, stake, status, payout")
    .eq("spectator_account_id", account.id).eq("match_id", matchId).maybeSingle();

  // Agregados del pozo: todas las bets pending de este match
  const { data: matchRow } = await service
    .from("match").select("team_a_id, team_b_id, scheduled_at_start").eq("id", matchId).maybeSingle();
  const { data: pendingBets } = await service
    .from("bet").select("picked_team_id, stake").eq("match_id", matchId).eq("status", "pending");

  const bets = (pendingBets ?? []) as any[];
  const sumStake = (pred: (b: any) => boolean) =>
    bets.filter(pred).reduce((acc, b) => acc + (b.stake ?? 0), 0);

  return {
    kind: "spectator",
    accountId: account.id,
    balance: wallet?.balance ?? 0,
    myBet: myBetRow
      ? {
          id: myBetRow.id,
          pickedTeamId: myBetRow.picked_team_id,
          stake: myBetRow.stake,
          status: myBetRow.status,
          payout: myBetRow.payout ?? 0,
        }
      : null,
    pool: bets.reduce((acc, b) => acc + (b.stake ?? 0), 0),
    stakeA: sumStake((b) => b.picked_team_id === matchRow?.team_a_id),
    stakeB: sumStake((b) => b.picked_team_id === matchRow?.team_b_id),
    bettors: bets.length,
    scheduledAtStart: matchRow?.scheduled_at_start ?? null,
  } as const;
}

// ============================================================
// Resolver el contexto de visualización pública (server-side)
// ============================================================
// Datos que la página muestra a TODOS los roles (capitán, espectador,
// anónimo): rosters de ambos equipos (banda "playing" del scoreboard) y
// el agregado del pozo (solo números, nunca quién apostó — las bets son
// privadas, service role como en resolveSpectatorContext).

async function resolveViewContext(supabase: any, matchId: string) {
  const service = getSupabaseServiceRole();

  // Rosters de ambos equipos EN PARALELO
  const { data: matchRow } = await service
    .from("match").select("team_a_id, team_b_id").eq("id", matchId).maybeSingle();
  const teamIds = [matchRow?.team_a_id, matchRow?.team_b_id].filter(Boolean) as string[];
  const [playersRows, pendingBets] = (await Promise.all([
    teamIds.length > 0
      ? service
          .from("player_registration")
          .select("id, display_name, is_captain, team_registration_id")
          .in("team_registration_id", teamIds)
      : Promise.resolve({ data: [] }),
    service
      .from("bet").select("stake").eq("match_id", matchId).eq("status", "pending"),
  ])) as { data: any }[];

  const players = playersRows?.data ?? [];
  const playersA = players
    .filter((p: any) => p.team_registration_id === matchRow?.team_a_id)
    .map((p: any) => ({ id: p.id, displayName: p.display_name, isCaptain: !!p.is_captain }));
  const playersB = players
    .filter((p: any) => p.team_registration_id === matchRow?.team_b_id)
    .map((p: any) => ({ id: p.id, displayName: p.display_name, isCaptain: !!p.is_captain }));

  const pool = (pendingBets?.data ?? []).reduce((acc: number, b: any) => acc + (b.stake ?? 0), 0);

  return {
    playersA,
    playersB,
    pool,
    bettors: (pendingBets?.data ?? []).length,
  };
}
