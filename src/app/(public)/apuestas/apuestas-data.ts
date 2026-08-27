/**
 * Módulo NEUTRO (sin "use client" / "use server") con el loader del hub
 * de apuestas. Se usa con el cliente service role porque los agregados
 * del pozo (pool total, stake por equipo) no están expuestos al anon:
 * las policies de `bet` solo permiten leer apuestas propias.
 */

import { BET_MAX_PAYOUT_MULT } from "@/lib/constants";

export interface LlaveTeam {
  id: string;
  name: string;
  seed: number | null;
}

export interface BettableLlave {
  matchId: string;
  roundName: string | null;
  format: string | null;
  scheduledAtStart: string | null;
  teamA: LlaveTeam;
  teamB: LlaveTeam;
  /** Pozo total de la llave (suma de stakes pendientes) */
  pool: number;
  stakeA: number;
  stakeB: number;
  bettors: number;
  myBet: { id: string; pickedTeamId: string; stake: number } | null;
}

export interface MyBet {
  id: string;
  matchId: string;
  stake: number;
  status: string;
  payout: number;
  placedAt: string | null;
  pickedTeamName: string;
  opponentName: string | null;
  matchLabel: string | null;
  matchStatus: string;
  /** Cuota vigente del lado elegido (solo pending en llave abierta) */
  cuota: number | null;
  /** Cobro estimado con la cuota actual si se acierta */
  cobroSiGana: number | null;
}

export interface RankingEntry {
  accountId: string;
  displayName: string;
  balance: number;
  /** Llaves liquidadas como ganadas (aciertos) */
  wins: number;
  /** Puntos propios apostados en llaves todavía abiertas */
  enJuego: number;
  isMe: boolean;
}

export interface ApuestasData {
  balance: number;
  ranking: RankingEntry[];
  myRank: number | null;
  totalSpectators: number;
  llaves: BettableLlave[];
  myBets: MyBet[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadApuestasData(admin: any, accountId: string): Promise<ApuestasData> {
  // ── Wallet propio ────────────────────────────────────────────
  const { data: wallet } = (await admin
    .from("spectator_wallet")
    .select("balance")
    .eq("account_id", accountId)
    .maybeSingle()) as { data: any };
  const balance: number = wallet?.balance ?? 0;

  // ── Ranking (todos los wallets, con nombre) ──────────────────
  const { data: wallets } = (await admin
    .from("spectator_wallet")
    .select("account_id, balance")
    .order("balance", { ascending: false })
    .limit(500)) as { data: any };
  const allWallets: { accountId: string; balance: number }[] = (wallets ?? []).map((w: any) => ({
    accountId: w.account_id,
    balance: w.balance ?? 0,
  }));

  let nameByAccount: Record<string, string> = {};
  const accountIds = allWallets.map((w) => w.accountId).filter(Boolean);
  if (accountIds.length > 0) {
    const { data: accounts } = (await admin
      .from("account")
      .select("id, display_name")
      .in("id", accountIds)) as { data: any };
    for (const a of accounts ?? []) {
      nameByAccount[a.id] = a.display_name ?? "Anónimo";
    }
  }

  // Microdetalles del ranking: aciertos y puntos en juego por espectador
  const statsByAccount: Record<string, { wins: number; enJuego: number }> = {};
  if (accountIds.length > 0) {
    const { data: betAgg } = (await admin
      .from("bet")
      .select("spectator_account_id, status, stake")
      .in("spectator_account_id", accountIds)) as { data: any };
    for (const b of betAgg ?? []) {
      const s = (statsByAccount[b.spectator_account_id] ??= { wins: 0, enJuego: 0 });
      if (b.status === "won") s.wins += 1;
      else if (b.status === "pending") s.enJuego += b.stake ?? 0;
    }
  }

  const ranking: RankingEntry[] = allWallets.slice(0, 20).map((w) => ({
    accountId: w.accountId,
    displayName: nameByAccount[w.accountId] ?? "Anónimo",
    balance: w.balance,
    wins: statsByAccount[w.accountId]?.wins ?? 0,
    enJuego: statsByAccount[w.accountId]?.enJuego ?? 0,
    isMe: w.accountId === accountId,
  }));
  const myRankIdx = allWallets.findIndex((w) => w.accountId === accountId);
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  // ── Llaves apostables: scheduled con ambos equipos ──────────
  const { data: matchesRaw } = (await admin
    .from("match")
    .select("id, format, scheduled_at_start, team_a_id, team_b_id, round_id")
    .eq("status", "scheduled")
    .not("team_a_id", "is", null)
    .not("team_b_id", "is", null)
    .order("scheduled_at_start", { ascending: true })
    .limit(40)) as { data: any };
  const scheduledMatches: any[] = matchesRaw ?? [];

  // Nombres de equipos (team_registration → team_account)
  const regIds = new Set<string>();
  for (const m of scheduledMatches) {
    if (m.team_a_id) regIds.add(m.team_a_id);
    if (m.team_b_id) regIds.add(m.team_b_id);
  }
  let teamById: Record<string, LlaveTeam> = {};
  if (regIds.size > 0) {
    const { data: regs } = (await admin
      .from("team_registration")
      .select("id, seed, team_account:team_account_id ( name )")
      .in("id", Array.from(regIds))) as { data: any };
    for (const r of regs ?? []) {
      teamById[r.id] = {
        id: r.id,
        name: r.team_account?.name ?? "—",
        seed: r.seed ?? null,
      };
    }
  }

  // Nombres de rondas
  const roundIds = Array.from(new Set(scheduledMatches.map((m) => m.round_id).filter(Boolean)));
  let roundNameById: Record<string, string> = {};
  if (roundIds.length > 0) {
    const { data: rounds } = (await admin
      .from("round")
      .select("id, name")
      .in("id", roundIds)) as { data: any };
    for (const r of rounds ?? []) roundNameById[r.id] = r.name;
  }

  // Bets de las llaves apostables (agregados + apuesta propia)
  const matchIds = scheduledMatches.map((m) => m.id);
  const llaveBets: any[] =
    matchIds.length > 0
      ? (((await admin
          .from("bet")
          .select("id, match_id, picked_team_id, stake, status, spectator_account_id")
          .in("match_id", matchIds)) as { data: any }).data ?? [])
      : [];

  const llaves: BettableLlave[] = scheduledMatches.map((m) => {
    const bets = llaveBets.filter((b) => b.match_id === m.id && b.status === "pending");
    let pool = 0;
    let stakeA = 0;
    let stakeB = 0;
    for (const b of bets) {
      pool += b.stake ?? 0;
      if (b.picked_team_id === m.team_a_id) stakeA += b.stake ?? 0;
      else if (b.picked_team_id === m.team_b_id) stakeB += b.stake ?? 0;
    }
    const mine = bets.find((b) => b.spectator_account_id === accountId);
    return {
      matchId: m.id,
      roundName: m.round_id ? roundNameById[m.round_id] ?? null : null,
      format: m.format ?? null,
      scheduledAtStart: m.scheduled_at_start ?? null,
      teamA: teamById[m.team_a_id] ?? { id: m.team_a_id, name: "Por definir", seed: null },
      teamB: teamById[m.team_b_id] ?? { id: m.team_b_id, name: "Por definir", seed: null },
      pool,
      stakeA,
      stakeB,
      bettors: bets.length,
      myBet: mine ? { id: mine.id, pickedTeamId: mine.picked_team_id, stake: mine.stake } : null,
    };
  });

  // ── Mis apuestas (historial, cualquier estado) ───────────────
  const { data: myBetsRaw } = (await admin
    .from("bet")
    .select("id, match_id, picked_team_id, stake, status, payout, placed_at, match:match_id ( status, round_id, team_a_id, team_b_id )")
    .eq("spectator_account_id", accountId)
    .order("placed_at", { ascending: false })
    .limit(30)) as { data: any };

  const extraRegIds = new Set<string>();
  const extraRoundIds = new Set<string>();
  for (const b of myBetsRaw ?? []) {
    if (b.picked_team_id) extraRegIds.add(b.picked_team_id);
    const m = b.match;
    if (m) {
      if (m.team_a_id) extraRegIds.add(m.team_a_id);
      if (m.team_b_id) extraRegIds.add(m.team_b_id);
      if (m.round_id) extraRoundIds.add(m.round_id);
    }
  }
  const missingRegIds = Array.from(extraRegIds).filter((id) => !teamById[id]);
  if (missingRegIds.length > 0) {
    const { data: regs } = (await admin
      .from("team_registration")
      .select("id, seed, team_account:team_account_id ( name )")
      .in("id", missingRegIds)) as { data: any };
    for (const r of regs ?? []) {
      teamById[r.id] = { id: r.id, name: r.team_account?.name ?? "—", seed: r.seed ?? null };
    }
  }
  const missingRoundIds = Array.from(extraRoundIds).filter((id) => !roundNameById[id]);
  if (missingRoundIds.length > 0) {
    const { data: rounds } = (await admin
      .from("round")
      .select("id, name")
      .in("id", missingRoundIds)) as { data: any };
    for (const r of rounds ?? []) roundNameById[r.id] = r.name;
  }

  const myBets: MyBet[] = (myBetsRaw ?? []).map((b: any) => {
    const m = b.match ?? {};
    const opponentId =
      b.picked_team_id === m.team_a_id ? m.team_b_id : b.picked_team_id === m.team_b_id ? m.team_a_id : null;
    // Cuota vigente del lado elegido: solo si sigue pending y la llave está abierta
    const agg = b.status === "pending" ? llaves.find((l) => l.matchId === b.match_id) : undefined;
    let cuota: number | null = null;
    let cobroSiGana: number | null = null;
    if (agg) {
      const side =
        b.picked_team_id === agg.teamA.id ? agg.stakeA : b.picked_team_id === agg.teamB.id ? agg.stakeB : 0;
      if (agg.pool > 0 && side > 0) {
        cuota = agg.pool / side;
        cobroSiGana = Math.min(
          Math.floor((b.stake ?? 0) * cuota),
          (b.stake ?? 0) * BET_MAX_PAYOUT_MULT
        );
      }
    }
    return {
      id: b.id,
      matchId: b.match_id,
      stake: b.stake ?? 0,
      status: b.status ?? "pending",
      payout: b.payout ?? 0,
      placedAt: b.placed_at ?? null,
      pickedTeamName: teamById[b.picked_team_id]?.name ?? "—",
      opponentName: opponentId ? teamById[opponentId]?.name ?? null : null,
      matchLabel: m.round_id ? roundNameById[m.round_id] ?? null : null,
      matchStatus: m.status ?? "scheduled",
      cuota,
      cobroSiGana,
    };
  });

  return {
    balance,
    ranking,
    myRank,
    totalSpectators: allWallets.length,
    llaves,
    myBets,
  };
}
