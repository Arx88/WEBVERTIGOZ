import Link from "next/link";
import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { loadMatch } from "./match-data";
import MatchRealtimeWrapper from "./match-realtime-wrapper";

export const dynamic = "force-dynamic";

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServer();
  let initialMatch = null;
  try {
    initialMatch = await loadMatch(supabase, id);
  } catch {
    initialMatch = null;
  }

  // Contexto del capitán: ¿el usuario logueado es capitán de un equipo de este match?
  let captainContext: import("@/components/captain/captain-match-panel").CaptainPanelContext | null = null;
  try {
    captainContext = await resolveCaptainContext(supabase as any, id);
  } catch {
    captainContext = null;
  }

  if (!initialMatch) {
    // Si no encontramos el match, mostramos un estado "no encontrado" con el diseño.
    return (
      <div className="vertigo-page vertigo-shell vertigo-fade-in">
        <header className="vertigo-header">
          <div className="vertigo-header-left">
            <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
            <span className="vertigo-section-tag">PARTIDO</span>
          </div>
          <div className="vertigo-header-right">
            <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
              ← Resultados
            </Link>
          </div>
        </header>
        <main className="vertigo-content">
          <span className="vertigo-kicker">PARTIDO</span>
          <h1 className="vertigo-title">Detalle del partido</h1>
          <div className="vertigo-divider"><span></span><i></i><span></span></div>
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
        </main>
      </div>
    );
  }

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">PARTIDO</span>
        </div>
        <div className="vertigo-header-right">
          <Link href="/bracket" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Bracket
          </Link>
          <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Resultados
          </Link>
        </div>
      </header>

      <main className="vertigo-content">
        <span className="vertigo-kicker">PARTIDO</span>
        <h1 className="vertigo-title">Detalle del partido</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Score, resultado del sorteo, civilizaciones, comodines usados y stream en vivo. Todo
          se actualiza en tiempo real cuando el staff ejecuta acciones.
        </p>

        <MatchRealtimeWrapper matchId={id} initialMatch={initialMatch} captainContext={captainContext} />
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

  // Jugadores anulados en este match (por comodín ANULAR)
  const service = getSupabaseServiceRole();
  const { data: usages } = await service
    .from("comodin_usage")
    .select("target_player_id")
    .eq("match_id", matchId)
    .eq("comodin_type", "anular")
    .eq("status", "executed");
  const annulledPlayerIds = (usages ?? []).map((u: any) => u.target_player_id).filter(Boolean);

  return {
    myTeamRegId: myReg.id,
    teamA_id: matchRow.team_a_id,
    teamB_id: matchRow.team_b_id,
    myPlayers: (players ?? []).map((p: any) => ({ id: p.id, display_name: p.display_name, is_captain: p.is_captain })),
    annulledPlayerIds,
  };
}
