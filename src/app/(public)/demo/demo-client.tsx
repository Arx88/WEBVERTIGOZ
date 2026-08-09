"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { ConfigProvider } from "@/lib/ruleta/config";
import { ALL_REINOS } from "@/lib/constants/emblems";
import { CIV_NAMES, civName } from "@/lib/constants/civs";
import Link from "next/link";

// Cargar la ruleta real dinámicamente (sin SSR)
const Roulette = dynamic(
  () => import("@/components/ruleta/roulette").then((m) => m.Roulette),
  { ssr: false }
) as React.ComponentType<any>;

// ============================================================
// TIPOS
// ============================================================

interface DemoTeam {
  id: string;
  name: string;
  tagline: string;
  emblemId: string;
  emblemUrl: string;
  elo: number;
  players: { name: string; elo: number; isCaptain: boolean }[];
  civPool: string[];
}

interface DemoMatch {
  id: string;
  roundIndex: number;
  roundName: string;
  slotIndex: number;
  teamA: DemoTeam | null;
  teamB: DemoTeam | null;
  winner: DemoTeam | null;
  status: "scheduled" | "open" | "drawing" | "lineup" | "comodin" | "playing" | "finished";
  sorteo?: {
    gameMode: string;
    antimeta?: string;
    playerMode: string;
    map: string;
    llaveFormat: string;
    civsA: string[];
    civsB: string[];
  };
  comodinesUsed?: { type: string; team: string; target?: string }[];
  scoreA: number;
  scoreB: number;
}

type DemoPhase =
  | "intro"
  | "seeding"
  | "bracket_ready"
  | "match_intro"
  | "match_roulette"
  | "match_sorteo_result"
  | "match_comodines"
  | "match_playing"
  | "match_result"
  | "round_complete"
  | "champion";

// ============================================================
// DATA GENERATION
// ============================================================

const TEAM_NAMES = [
  "Caballeros del Caos", "Legión Oscura", "Guardia Real", "Señores del Norte",
  "Cazadores Sombríos", "Imperio de Plata", "Guerreros del Alba", "Fénix Dorado",
  "Lobos de Guerra", "Corona de Hierro", "Espadas Eternas", "Dragones Carmesí",
  "Sombras de Acero", "Alianza Dorada", "Vengadores Reales", "Orden Sagrada",
  "Castigadores", "Hueste Imperial", "Vigilantes Nocturnos", "Conquistadores",
  "Falange Púrpura", "Tribunal de Acero", "Centinelas", "Ejército Berserker",
  "Tropa de Élite", "Regimiento Real", "Batallón Sombrío", "Fuerza Especial",
  "Comando Imperial", "Escuadrón Púrpura", "División de Hierro", "Legión Invicta",
];

const TAGLINES = [
  "Honor eterno", "Victoria o muerte", "Por la corona", "Sin rendición",
  "Fuego y acero", "La gloria nos espera", "Unidos vencemos", "Inquebrantables",
  "Sangre y honor", "El destino nos llama", "Firmes como la roca", "Hasta el final",
  "Por el reino", "Nuestra hora llegó", "Conquistaremos", "Inmortales",
];

const PLAYER_NAMES = [
  "Acido", "Rebelbyte", "Prisma09", "ShadowKing", "NightHunter", "BladeMaster",
  "StormRider", "IceWolf", "FireHawk", "DarkLord", "IronFist", "GoldenArrow",
  "SilverFox", "RedDragon", "BlueKnight", "WhiteTiger", "BlackHawk", "GreenArrow",
  "PurpleRain", "OrangeFlash", "YellowJacket", "CyanStorm", "MagentaQueen", "CrimsonBlade",
  "SteelHeart", "BronzeFist", "DiamondEdge", "PlatinumMind", "ObsidianSoul", "CrystalEye",
  "VoidWalker", "AstralLord", "CosmicRider", "NebulaStar", "SolarFlare", "LunarShade",
  "ThunderGod", "FrostGiant", "EarthShaker", "WindWalker", "FlameKeeper", "TideRider",
  "StarForged", "MoonShadow", "SunBreaker", "DawnBringer", "DuskFaller", "TwilightHunter",
  "EternalFlame", "RisingAsh", "FallingStar", "CrimsonTide", "IronVow", "SilverLine",
  "GhostWalker", "PhantomStrike", "SpecterWail", "WraithKing", "BansheeQueen", "ReaperSoul",
  "HolyLight", "SacredOath", "DivineWrath", "BlessedBlade", "ChosenOne", "AnointedKing",
  "FallenHero", "RisenLord", "BrokenCrown", "ShatteredRealm", "EndlessMarch", "FinalStand",
  "ValorUnbound", "GlorySeeker", "HonorBound", "DutyFirst", "OathKeeper", "VowBreaker",
  "ChainBreaker", "SoulTaker", "MindBender", "RealityWeaver", "DreamChaser", "Nightmare",
  "PhoenixRising", "DragonSlayer", "HydraHead", "ChimeraEye", "GriffinClaw", "BasiliskGaze",
];

const GAME_MODES = ["ANTIMETA", "GUERRAS IMPERIALES", "MUERTE SÚBITA", "REGICIDA"];
const ANTIMETAS = ["500 POP", "BARCOS", "FEUDAL", "MESOAMÉRICA", "REY DE LA COLINA", "UNIDADES ÚNICAS"];
const PLAYER_MODES = ["1 VS 1", "2 VS 2", "3 VS 3", "TEAM"];
const MAPS = ["ARABIA", "ARENA", "ATACAMA", "CRÁTER", "CRESTA MONTAÑOSA", "CUATRO LAGOS", "CUENCA DEL ORO", "MIGRACIÓN", "TORMENTA DE POLVO"];
const LLAVE_FORMATS = ["DEATHMATCH", "BO3"];
const CIV_KEYS = Object.keys(CIV_NAMES);

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCivs(count: number, pool?: string[]): string[] {
  const source = pool ?? CIV_KEYS;
  const available = [...source];
  const result: string[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    result.push(available.splice(idx, 1)[0]);
  }
  return result;
}

function generateTeams(): DemoTeam[] {
  return TEAM_NAMES.map((name, i) => {
    const reino = ALL_REINOS[i % ALL_REINOS.length];
    const playerCount = 3;
    const players = Array.from({ length: playerCount }, (_, j) => {
      const nameIdx = (i * 3 + j) % PLAYER_NAMES.length;
      return {
        name: PLAYER_NAMES[nameIdx],
        elo: 800 + Math.floor(Math.random() * 600),
        isCaptain: j === 0,
      };
    });
    const totalElo = players.reduce((s, p) => s + p.elo, 0);
    return {
      id: `team-${i + 1}`,
      name,
      tagline: randomFrom(TAGLINES),
      emblemId: reino.id,
      emblemUrl: reino.img,
      elo: totalElo,
      players,
      civPool: randomCivs(9),
    };
  });
}

function generateSorteo(teamA: DemoTeam, teamB: DemoTeam) {
  const gameMode = randomFrom(GAME_MODES);
  const antimeta = gameMode === "ANTIMETA" ? randomFrom(ANTIMETAS) : undefined;
  const playerMode = randomFrom(PLAYER_MODES);
  const map = randomFrom(MAPS);
  const llaveFormat = randomFrom(LLAVE_FORMATS);

  // Civs según playerMode
  let civCount = 1;
  if (playerMode === "2 VS 2") civCount = 2;
  else if (playerMode === "3 VS 3") civCount = 3;
  else if (playerMode === "TEAM") civCount = 1; // fusión: 1 civ compartida

  return {
    gameMode,
    antimeta,
    playerMode,
    map,
    llaveFormat,
    civsA: randomCivs(civCount, teamA.civPool),
    civsB: randomCivs(civCount, teamB.civPool),
  };
}

// ============================================================
// BRACKET GENERATION (simplified for demo)
// ============================================================

const ROUND_NAMES = ["Ronda 1", "Octavos de Final", "Cuartos de Final", "Semifinal", "Final"];

function generateBracket(teams: DemoTeam[]): DemoMatch[][] {
  // Shuffle teams for seeding
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const rounds: DemoMatch[][] = [];

  // R1: 16 matches
  const r1: DemoMatch[] = [];
  for (let i = 0; i < 16; i++) {
    r1.push({
      id: `r0-s${i}`,
      roundIndex: 0,
      roundName: ROUND_NAMES[0],
      slotIndex: i,
      teamA: shuffled[i * 2],
      teamB: shuffled[i * 2 + 1],
      winner: null,
      status: "scheduled",
      scoreA: 0,
      scoreB: 0,
    });
  }
  rounds.push(r1);

  // R2-R5: empty, filled as we go
  for (let r = 1; r < 5; r++) {
    const count = 16 / Math.pow(2, r);
    const matches: DemoMatch[] = [];
    for (let i = 0; i < count; i++) {
      matches.push({
        id: `r${r}-s${i}`,
        roundIndex: r,
        roundName: ROUND_NAMES[r],
        slotIndex: i,
        teamA: null,
        teamB: null,
        winner: null,
        status: "scheduled",
        scoreA: 0,
        scoreB: 0,
      });
    }
    rounds.push(matches);
  }

  return rounds;
}

// ============================================================
// COMPONENT
// ============================================================

export default function DemoClient() {
  const [phase, setPhase] = useState<DemoPhase>("intro");
  const [teams] = useState<DemoTeam[]>(() => generateTeams());
  const [bracket, setBracket] = useState<DemoMatch[][]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [champion, setChampion] = useState<DemoTeam | null>(null);
  const [sorteo, setSorteo] = useState<any>(null);
  const [comodinEvent, setComodinEvent] = useState<string | null>(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [matchCounter, setMatchCounter] = useState(0);
  const [completedMatches, setCompletedMatches] = useState(0);

  // Iniciar bracket
  const startTournament = useCallback(() => {
    const b = generateBracket(teams);
    setBracket(b);
    setCurrentRound(0);
    setCurrentMatchIdx(0);
    setMatchCounter(0);
    setCompletedMatches(0);
    setPhase("seeding");
  }, [teams]);

  // Avanzar al siguiente match
  const goToNextMatch = useCallback(() => {
    const round = bracket[currentRound];
    if (!round) return;

    const nextIdx = currentMatchIdx + 1;
    if (nextIdx < round.length) {
      setCurrentMatchIdx(nextIdx);
      setPhase("match_intro");
    } else {
      // Ronda completa
      if (currentRound < 4) {
        setPhase("round_complete");
      } else {
        // Torneo terminado
        const finalMatch = bracket[4][0];
        if (finalMatch?.winner) {
          setChampion(finalMatch.winner);
          setPhase("champion");
        }
      }
    }
  }, [bracket, currentRound, currentMatchIdx]);

  // Avanzar a la siguiente ronda
  const advanceToNextRound = useCallback(() => {
    const nextRound = currentRound + 1;
    if (nextRound < 5) {
      setCurrentRound(nextRound);
      setCurrentMatchIdx(0);
      setPhase("match_intro");
    }
  }, [currentRound]);

  // Iniciar sorteo del match actual
  const startRoulette = useCallback(() => {
    const match = bracket[currentRound]?.[currentMatchIdx];
    if (!match?.teamA || !match?.teamB) return;

    const s = generateSorteo(match.teamA, match.teamB);
    setSorteo(s);
    setShowRoulette(true);
    setPhase("match_roulette");
  }, [bracket, currentRound, currentMatchIdx]);

  // Cuando la ruleta termina
  const onRouletteResult = useCallback(() => {
    setShowRoulette(false);
    setPhase("match_sorteo_result");
  }, []);

  // Simular uso de comodín (aleatorio, ~30% chance)
  const simulateComodines = useCallback(() => {
    const match = bracket[currentRound]?.[currentMatchIdx];
    if (!match?.teamA || !match?.teamB) return;

    const useComodin = Math.random() < 0.35;
    if (useComodin) {
      const comodinTypes = [
        { type: "Re-girar", desc: "re-sortea el mapa", effect: () => {
          if (sorteo) {
            const newMap = randomFrom(MAPS.filter(m => m !== sorteo.map));
            setSorteo({ ...sorteo, map: newMap });
          }
        }},
        { type: "Anular jugador", desc: `obliga a ${match.teamB.name} a sacar a un jugador`, effect: () => {} },
        { type: "Elegir rival", desc: `${match.teamA.name} elige quién juega del rival`, effect: () => {} },
      ];
      const chosen = randomFrom(comodinTypes);
      const team = Math.random() < 0.5 ? match.teamA.name : match.teamB.name;
      setComodinEvent(`${team} usa: ${chosen.type} — ${chosen.desc}`);
      chosen.effect();
    } else {
      setComodinEvent(null);
    }
    setPhase("match_comodines");
  }, [bracket, currentRound, currentMatchIdx, sorteo]);

  // Simular resultado del match
  const simulateResult = useCallback(() => {
    const match = bracket[currentRound]?.[currentMatchIdx];
    if (!match?.teamA || !match?.teamB) return;

    // Resultado aleatorio (con leve ventaja para ELO más alto)
    const eloDiff = match.teamA.elo - match.teamB.elo;
    const advantageA = Math.max(0, Math.min(0.3, eloDiff / 3000));
    const teamAWins = Math.random() < (0.5 + advantageA);

    const winner = teamAWins ? match.teamA : match.teamB;
    const loser = teamAWins ? match.teamB : match.teamA;

    // Score según formato
    let scoreA: number, scoreB: number;
    if (sorteo?.llaveFormat === "BO3") {
      // BO3: 2-0 o 2-1
      const sweep = Math.random() < 0.4;
      if (teamAWins) {
        scoreA = 2;
        scoreB = sweep ? 0 : 1;
      } else {
        scoreA = sweep ? 0 : 1;
        scoreB = 2;
      }
    } else {
      // Deathmatch: 1-0
      scoreA = teamAWins ? 1 : 0;
      scoreB = teamAWins ? 0 : 1;
    }

    // Actualizar bracket
    setBracket(prev => {
      const updated = [...prev];
      const m = { ...updated[currentRound][currentMatchIdx] };
      m.winner = winner;
      m.status = "finished";
      m.scoreA = scoreA;
      m.scoreB = scoreB;
      m.sorteo = sorteo;
      updated[currentRound][currentMatchIdx] = m;

      // Avanzar ganador al próximo round
      if (currentRound < 4) {
        const nextSlot = Math.floor(currentMatchIdx / 2);
        const nextMatch = { ...updated[currentRound + 1][nextSlot] };
        if (currentMatchIdx % 2 === 0) {
          nextMatch.teamA = winner;
        } else {
          nextMatch.teamB = winner;
        }
        updated[currentRound + 1][nextSlot] = nextMatch;
      }

      return updated;
    });

    setCompletedMatches(prev => prev + 1);
    setPhase("match_result");
  }, [bracket, currentRound, currentMatchIdx, sorteo]);

  // Match actual
  const currentMatch = bracket[currentRound]?.[currentMatchIdx];

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <ConfigProvider>
      <div style={{
        minHeight: "100vh",
        background: "#070310",
        backgroundImage: `
          radial-gradient(900px 520px at 12% 8%, rgba(88, 28, 175, .16), transparent 60%),
          radial-gradient(800px 500px at 88% 85%, rgba(124, 58, 237, .10), transparent 60%),
          radial-gradient(1400px 900px at 50% 50%, rgba(20, 8, 40, .5), transparent 75%)
        `,
        color: "#f2eef7",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}>
        {/* ============================================================ */}
        {/* INTRO */}
        {/* ============================================================ */}
        {phase === "intro" && (
          <IntroScreen onStart={startTournament} />
        )}

        {/* ============================================================ */}
        {/* SEEDING — Sorteo inicial del bracket */}
        {/* ============================================================ */}
        {phase === "seeding" && (
          <SeedingScreen teams={teams} onDone={() => setPhase("bracket_ready")} />
        )}

        {/* ============================================================ */}
        {/* BRACKET READY — muestra bracket completo antes de empezar */}
        {/* ============================================================ */}
        {phase === "bracket_ready" && (
          <BracketReadyScreen
            bracket={bracket}
            currentRound={currentRound}
            onStart={() => setPhase("match_intro")}
          />
        )}

        {/* ============================================================ */}
        {/* MATCH INTRO — presenta el match que viene */}
        {/* ============================================================ */}
        {phase === "match_intro" && currentMatch && (
          <MatchIntroScreen
            match={currentMatch}
            matchNumber={completedMatches + 1}
            totalMatches={31}
            onContinue={startRoulette}
          />
        )}

        {/* ============================================================ */}
        {/* MATCH ROULETTE — la ruleta gira */}
        {/* ============================================================ */}
        {phase === "match_roulette" && showRoulette && currentMatch && (
          <RouletteScreen
            match={currentMatch}
            onResult={onRouletteResult}
          />
        )}

        {/* ============================================================ */}
        {/* MATCH SORTEO RESULT — muestra qué salió */}
        {/* ============================================================ */}
        {phase === "match_sorteo_result" && currentMatch && sorteo && (
          <SorteoResultScreen
            match={currentMatch}
            sorteo={sorteo}
            onContinue={simulateComodines}
          />
        )}

        {/* ============================================================ */}
        {/* MATCH COMODINES — ventana de comodines */}
        {/* ============================================================ */}
        {phase === "match_comodines" && currentMatch && sorteo && (
          <ComodinScreen
            match={currentMatch}
            sorteo={sorteo}
            comodinEvent={comodinEvent}
            onContinue={simulateResult}
          />
        )}

        {/* ============================================================ */}
        {/* MATCH RESULT — resultado final del match */}
        {/* ============================================================ */}
        {phase === "match_result" && currentMatch && sorteo && (
          <MatchResultScreen
            match={currentMatch}
            sorteo={sorteo}
            onContinue={goToNextMatch}
          />
        )}

        {/* ============================================================ */}
        {/* ROUND COMPLETE — ronda terminada */}
        {/* ============================================================ */}
        {phase === "round_complete" && (
          <RoundCompleteScreen
            round={currentRound}
            bracket={bracket}
            onContinue={advanceToNextRound}
          />
        )}

        {/* ============================================================ */}
        {/* CHAMPION — campeón del torneo */}
        {/* ============================================================ */}
        {phase === "champion" && champion && (
          <ChampionScreen champion={champion} onRestart={() => {
            setPhase("intro");
            setBracket([]);
            setChampion(null);
          }} />
        )}

        {/* Progress bar fijo arriba */}
        {phase !== "intro" && phase !== "seeding" && (
          <DemoProgressBar
            phase={phase}
            currentRound={currentRound}
            currentMatchIdx={currentMatchIdx}
            completedMatches={completedMatches}
            bracket={bracket}
          />
        )}
      </div>
    </ConfigProvider>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
      textAlign: "center",
    }}>
      <img src="/landing/logo.png" alt="VÉRTIGO Cup" style={{ width: "120px", marginBottom: "32px" }} />
      <span style={{
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "3px",
        color: "#7c3aed",
        textTransform: "uppercase",
        marginBottom: "16px",
      }}>
        Demo Interactiva
      </span>
      <h1 style={{
        fontFamily: "Cinzel, serif",
        fontSize: "48px",
        fontWeight: 700,
        letterSpacing: "2px",
        textTransform: "uppercase",
        marginBottom: "16px",
        textShadow: "0 0 30px rgba(124, 58, 237, 0.4)",
      }}>
        VÉRTIGO Cup
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "16px 0 24px" }}>
        <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #3a2f4a)" }} />
        <span style={{ width: 7, height: 7, border: "1px solid #a78bfa", transform: "rotate(45deg)" }} />
        <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #3a2f4a, transparent)" }} />
      </div>
      <p style={{
        fontSize: "16px",
        color: "#9a92a6",
        maxWidth: "560px",
        lineHeight: 1.7,
        marginBottom: "32px",
      }}>
        Recorré el torneo completo de punta a punta: 32 equipos, 31 partidas, 5 rondas.
        Sorteo inicial, ruleta en cada match, comodines, resultados y coronación del campeón.
        Así se vería en el stream.
      </p>
      <button
        onClick={onStart}
        style={{
          padding: "18px 40px",
          background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 8px 32px rgba(109, 40, 217, 0.4)",
          transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 12px 40px rgba(109, 40, 217, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "0 8px 32px rgba(109, 40, 217, 0.4)";
        }}
      >
        Iniciar Demo →
      </button>
      <Link href="/" style={{
        marginTop: "20px",
        fontSize: "12px",
        color: "#6b6378",
        textDecoration: "none",
      }}>
        ← Volver al inicio
      </Link>
    </div>
  );
}

function SeedingScreen({ teams, onDone }: { teams: DemoTeam[]; onDone: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (revealed >= 32) {
      setDone(true);
      setTimeout(onDone, 2000);
      return;
    }
    const timer = setTimeout(() => setRevealed(r => r + 1), 80);
    return () => clearTimeout(timer);
  }, [revealed, onDone]);

  return (
    <div style={{ minHeight: "100vh", padding: "40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "12px" }}>
        SORTEO INICIAL
      </span>
      <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "32px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
        Asignando seeds...
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "12px 0 32px" }}>
        <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #3a2f4a)", maxWidth: "200px" }} />
        <span style={{ width: 7, height: 7, border: "1px solid #a78bfa", transform: "rotate(45deg)" }} />
        <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #3a2f4a, transparent)", maxWidth: "200px" }} />
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "12px",
        maxWidth: "900px",
        width: "100%",
      }}>
        {teams.map((team, i) => {
          const isRevealed = i < revealed;
          return (
            <div key={team.id} style={{
              padding: "14px",
              background: isRevealed ? "rgba(124, 58, 237, 0.08)" : "rgba(13, 9, 19, 0.4)",
              border: `1px solid ${isRevealed ? "rgba(124, 58, 237, 0.3)" : "#1a1424"}`,
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              opacity: isRevealed ? 1 : 0.3,
              transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
            }}>
              {isRevealed ? (
                <>
                  <img src={team.emblemUrl} alt="" style={{ width: "32px", height: "32px", objectFit: "contain", flex: "none" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "10px", color: "#a78bfa", fontWeight: 700 }}>SEED #{i + 1}</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "12px", color: "#6b6378" }}>???</div>
              )}
            </div>
          );
        })}
      </div>

      {done && (
        <div style={{ marginTop: "32px", fontSize: "14px", color: "#22c55e", fontWeight: 700, letterSpacing: "1px" }}>
          ✓ SEEDS ASIGNADOS — Generando bracket...
        </div>
      )}
    </div>
  );
}

function BracketReadyScreen({ bracket, currentRound, onStart }: { bracket: DemoMatch[][]; currentRound: number; onStart: () => void }) {
  return (
    <div style={{ minHeight: "100vh", padding: "40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "12px" }}>
        BRACKET GENERADO
      </span>
      <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "32px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
        32 Equipos · 31 Partidas
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "12px 0 32px" }}>
        <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #3a2f4a)", maxWidth: "200px" }} />
        <span style={{ width: 7, height: 7, border: "1px solid #a78bfa", transform: "rotate(45deg)" }} />
        <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #3a2f4a, transparent)", maxWidth: "200px" }} />
      </div>

      {/* Bracket visual compacto */}
      <div style={{ overflowX: "auto", maxWidth: "100%", paddingBottom: "16px" }}>
        <div style={{ display: "flex", gap: "16px", minWidth: "max-content" }}>
          {bracket.map((round, ri) => (
            <div key={ri} style={{ minWidth: "180px" }}>
              <div style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "#a78bfa",
                marginBottom: "10px",
                paddingBottom: "6px",
                borderBottom: "1px solid #241d2f",
              }}>
                {ROUND_NAMES[ri]}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {round.map((match) => {
                  const hasTeams = match.teamA && match.teamB;
                  const isFinished = match.status === "finished";
                  return (
                    <div key={match.id} style={{
                      padding: "8px 10px",
                      background: isFinished ? "rgba(34, 197, 94, 0.05)" : "rgba(13, 9, 19, 0.6)",
                      border: `1px solid ${isFinished ? "rgba(34, 197, 94, 0.2)" : "#1a1424"}`,
                      borderRadius: "8px",
                      opacity: hasTeams ? 1 : 0.4,
                      fontSize: "11px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          color: match.winner === match.teamA ? "#22c55e" : "#9a92a6",
                          fontWeight: match.winner === match.teamA ? 700 : 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}>
                          {match.teamA ? match.teamA.name : "—"}
                        </span>
                        {isFinished && <span style={{ color: match.winner === match.teamA ? "#22c55e" : "#6b6378", fontFamily: "monospace" }}>{match.scoreA}</span>}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                        <span style={{
                          color: match.winner === match.teamB ? "#22c55e" : "#9a92a6",
                          fontWeight: match.winner === match.teamB ? 700 : 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}>
                          {match.teamB ? match.teamB.name : "—"}
                        </span>
                        {isFinished && <span style={{ color: match.winner === match.teamB ? "#22c55e" : "#6b6378", fontFamily: "monospace" }}>{match.scoreB}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onStart}
        style={{
          marginTop: "32px",
          padding: "16px 36px",
          background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 6px 26px rgba(109, 40, 217, 0.35)",
        }}
      >
        Comenzar Ronda 1 →
      </button>
    </div>
  );
}

function MatchIntroScreen({ match, matchNumber, totalMatches, onContinue }: { match: DemoMatch; matchNumber: number; totalMatches: number; onContinue: () => void }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
    }}>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "8px" }}>
        {match.roundName} · Match {matchNumber} de {totalMatches}
      </span>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: "40px",
        alignItems: "center",
        marginTop: "32px",
        maxWidth: "800px",
        width: "100%",
      }}>
        {/* Team A */}
        <TeamPresentation team={match.teamA} side="left" />

        {/* VS */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "Cinzel, serif",
            fontSize: "48px",
            fontWeight: 700,
            color: "#7c3aed",
            textShadow: "0 0 20px rgba(124, 58, 237, 0.4)",
          }}>
            VS
          </div>
        </div>

        {/* Team B */}
        <TeamPresentation team={match.teamB} side="right" />
      </div>

      <button
        onClick={onContinue}
        style={{
          marginTop: "48px",
          padding: "16px 36px",
          background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 6px 26px rgba(109, 40, 217, 0.35)",
        }}
      >
        🎰 Tirar Ruleta
      </button>
    </div>
  );
}

function TeamPresentation({ team, side }: { team: DemoTeam | null; side: "left" | "right" }) {
  if (!team) {
    return <div style={{ textAlign: side === "left" ? "right" : "left", opacity: 0.3 }}>
      <div style={{ fontSize: "14px", color: "#6b6378" }}>Por definir</div>
    </div>;
  }
  return (
    <div style={{ textAlign: side === "left" ? "right" : "left" }}>
      <img
        src={team.emblemUrl}
        alt={team.name}
        style={{
          width: "80px",
          height: "80px",
          objectFit: "contain",
          marginBottom: "12px",
          marginLeft: side === "right" ? "auto" : "0",
          marginRight: side === "left" ? "auto" : "0",
          display: "block",
          filter: "drop-shadow(0 4px 12px rgba(124, 58, 237, 0.2))",
        }}
      />
      <div style={{ fontSize: "11px", color: "#a78bfa", fontWeight: 700, letterSpacing: "1px" }}>ELO {team.elo}</div>
      <h2 style={{
        fontFamily: "Cinzel, serif",
        fontSize: "20px",
        fontWeight: 700,
        marginTop: "4px",
        marginBottom: "4px",
      }}>
        {team.name}
      </h2>
      <div style={{ fontSize: "12px", color: "#6b6378", fontStyle: "italic" }}>"{team.tagline}"</div>
      <div style={{ fontSize: "11px", color: "#9a92a6", marginTop: "8px" }}>
        {team.players.map(p => p.name).join(" · ")}
      </div>
    </div>
  );
}

function RouletteScreen({ match, onResult }: { match: DemoMatch; onResult: () => void }) {
  // La ruleta real del componente Roulette
  // En modo demo (sin props), funciona con random puro
  // Después de que termina (phase="final"), llamamos onResult

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {/* Header del match */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        padding: "16px 32px",
        background: "rgba(7, 3, 16, 0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1a1424",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={match.teamA?.emblemUrl} alt="" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{match.teamA?.name}</span>
        </div>
        <span style={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "2px",
          color: "#fbbf24",
          textTransform: "uppercase",
          animation: "pulse 1.5s ease-in-out infinite",
        }}>
          🎰 SORTEANDO...
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{match.teamB?.name}</span>
          <img src={match.teamB?.emblemUrl} alt="" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
        </div>
      </div>

      {/* La ruleta real */}
      <Roulette onResult={async () => {
        // Esperar 2 segundos para que el usuario vea los resultados en la ruleta
        setTimeout(onResult, 3000);
      }} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function SorteoResultScreen({ match, sorteo, onContinue }: { match: DemoMatch; sorteo: any; onContinue: () => void }) {
  const items = [
    { label: "Modo de Juego", value: sorteo.gameMode, icon: "⚔️" },
    ...(sorteo.antimeta ? [{ label: "Antimeta", value: sorteo.antimeta, icon: "🌀" }] : []),
    { label: "Formato", value: sorteo.playerMode, icon: "👥" },
    { label: "Mapa", value: sorteo.map, icon: "🗺️" },
    { label: "Llave", value: sorteo.llaveFormat, icon: "🔑" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
    }}>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "8px" }}>
        RESULTADO DEL SORTEO
      </span>
      <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "28px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "24px" }}>
        {match.teamA?.name} vs {match.teamB?.name}
      </h1>

      {/* Grid de resultados */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "12px",
        maxWidth: "700px",
        width: "100%",
        marginBottom: "24px",
      }}>
        {items.map((item, i) => (
          <div key={i} style={{
            padding: "16px",
            background: "rgba(124, 58, 237, 0.06)",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            borderRadius: "10px",
            textAlign: "center",
            animation: `fadeUp 0.4s cubic-bezier(.22,1,.36,1) both`,
            animationDelay: `${i * 0.1}s`,
          }}>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>{item.icon}</div>
            <div style={{ fontSize: "10px", color: "#6b6378", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>{item.label}</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#c4b5fd" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Civs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "700px", width: "100%", marginBottom: "32px" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#9a92a6", marginBottom: "8px" }}>Civs {match.teamA?.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {sorteo.civsA.map((c: string) => (
              <span key={c} style={{
                padding: "6px 12px",
                background: "rgba(13, 9, 19, 0.8)",
                border: "1px solid #2a2334",
                borderRadius: "999px",
                fontSize: "12px",
                color: "#f2eef7",
              }}>
                {civName(c)}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#9a92a6", marginBottom: "8px" }}>Civs {match.teamB?.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {sorteo.civsB.map((c: string) => (
              <span key={c} style={{
                padding: "6px 12px",
                background: "rgba(13, 9, 19, 0.8)",
                border: "1px solid #2a2334",
                borderRadius: "999px",
                fontSize: "12px",
                color: "#f2eef7",
              }}>
                {civName(c)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onContinue}
        style={{
          padding: "14px 32px",
          background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 6px 26px rgba(109, 40, 217, 0.35)",
        }}
      >
        Ventana de Comodines →
      </button>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

function ComodinScreen({ match, sorteo, comodinEvent, onContinue }: { match: DemoMatch; sorteo: any; comodinEvent: string | null; onContinue: () => void }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
    }}>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#fbbf24", textTransform: "uppercase", marginBottom: "8px" }}>
        ⚡ VENTANA DE COMODINES
      </span>
      <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "28px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "24px" }}>
        T-05:00 restantes
      </h1>

      {/* Comodín usado o "sin comodines" */}
      {comodinEvent ? (
        <div style={{
          padding: "24px",
          background: "rgba(251, 191, 36, 0.08)",
          border: "1px solid rgba(251, 191, 36, 0.3)",
          borderRadius: "12px",
          maxWidth: "500px",
          textAlign: "center",
          marginBottom: "32px",
          animation: "fadeUp 0.4s cubic-bezier(.22,1,.36,1) both",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🎴</div>
          <div style={{ fontSize: "15px", color: "#fbbf24", fontWeight: 700, lineHeight: 1.5 }}>
            {comodinEvent}
          </div>
          {sorteo.map && (
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#9a92a6" }}>
              {sorteo.playerMode} · {sorteo.map} · {sorteo.llaveFormat}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: "24px",
          background: "rgba(13, 9, 19, 0.6)",
          border: "1px solid #241d2f",
          borderRadius: "12px",
          maxWidth: "500px",
          textAlign: "center",
          marginBottom: "32px",
        }}>
          <div style={{ fontSize: "14px", color: "#9a92a6" }}>
            Ningún equipo usó comodines en esta ventana.
          </div>
        </div>
      )}

      <button
        onClick={onContinue}
        style={{
          padding: "14px 32px",
          background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 6px 26px rgba(109, 40, 217, 0.35)",
        }}
      >
        Iniciar Partida →
      </button>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

function MatchResultScreen({ match, sorteo, onContinue }: { match: DemoMatch; sorteo: any; onContinue: () => void }) {
  const winner = match.winner;
  const loser = match.winner === match.teamA ? match.teamB : match.teamA;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
    }}>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#22c55e", textTransform: "uppercase", marginBottom: "8px" }}>
        PARTIDA FINALIZADA
      </span>

      {/* Scoreboard grande */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: "32px",
        alignItems: "center",
        marginTop: "24px",
        maxWidth: "800px",
        width: "100%",
      }}>
        {/* Team A */}
        <div style={{ textAlign: "center", opacity: winner === match.teamA ? 1 : 0.4 }}>
          <img src={match.teamA?.emblemUrl} alt="" style={{ width: "72px", height: "72px", objectFit: "contain", marginBottom: "8px", filter: winner === match.teamA ? "drop-shadow(0 4px 16px rgba(34, 197, 94, 0.3))" : "grayscale(0.5)" }} />
          <div style={{ fontFamily: "Cinzel, serif", fontSize: "18px", fontWeight: 700, color: winner === match.teamA ? "#22c55e" : "#6b6378" }}>
            {match.teamA?.name}
          </div>
        </div>

        {/* Score */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "Cinzel, serif",
            fontSize: "64px",
            fontWeight: 700,
            color: "#f2eef7",
            fontVariantNumeric: "tabular-nums",
          }}>
            {match.scoreA}<span style={{ color: "#6b6378", margin: "0 8px" }}>-</span>{match.scoreB}
          </div>
          <div style={{ fontSize: "12px", color: "#9a92a6", marginTop: "8px" }}>
            {sorteo.llaveFormat} · {sorteo.map}
          </div>
        </div>

        {/* Team B */}
        <div style={{ textAlign: "center", opacity: winner === match.teamB ? 1 : 0.4 }}>
          <img src={match.teamB?.emblemUrl} alt="" style={{ width: "72px", height: "72px", objectFit: "contain", marginBottom: "8px", filter: winner === match.teamB ? "drop-shadow(0 4px 16px rgba(34, 197, 94, 0.3))" : "grayscale(0.5)" }} />
          <div style={{ fontFamily: "Cinzel, serif", fontSize: "18px", fontWeight: 700, color: winner === match.teamB ? "#22c55e" : "#6b6378" }}>
            {match.teamB?.name}
          </div>
        </div>
      </div>

      {/* Ganador destacado */}
      <div style={{
        marginTop: "32px",
        padding: "16px 32px",
        background: "rgba(34, 197, 94, 0.08)",
        border: "1px solid rgba(34, 197, 94, 0.3)",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <span style={{ fontSize: "24px" }}>🏆</span>
        <span style={{ fontFamily: "Cinzel, serif", fontSize: "18px", fontWeight: 700, color: "#22c55e" }}>
          {winner?.name} avanza a la siguiente ronda
        </span>
      </div>

      <button
        onClick={onContinue}
        style={{
          marginTop: "32px",
          padding: "14px 32px",
          background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 6px 26px rgba(109, 40, 217, 0.35)",
        }}
      >
        Continuar →
      </button>
    </div>
  );
}

function RoundCompleteScreen({ round, bracket, onContinue }: { round: number; bracket: DemoMatch[][]; onContinue: () => void }) {
  const completedRound = bracket[round];
  const nextRoundName = ROUND_NAMES[round + 1];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
    }}>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#22c55e", textTransform: "uppercase", marginBottom: "8px" }}>
        RONDA COMPLETADA
      </span>
      <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "32px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "24px" }}>
        {ROUND_NAMES[round]} ✓
      </h1>

      {/* Ganadores de la ronda */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "10px",
        maxWidth: "700px",
        width: "100%",
        marginBottom: "32px",
      }}>
        {completedRound.map((match, i) => (
          <div key={i} style={{
            padding: "12px",
            background: "rgba(34, 197, 94, 0.05)",
            border: "1px solid rgba(34, 197, 94, 0.15)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <img src={match.winner?.emblemUrl} alt="" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#22c55e" }}>
              {match.winner?.name}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: "14px", color: "#a78bfa", marginBottom: "24px" }}>
        {completedRound.length} equipos avanzan a <strong>{nextRoundName}</strong>
      </div>

      <button
        onClick={onContinue}
        style={{
          padding: "16px 36px",
          background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 6px 26px rgba(109, 40, 217, 0.35)",
        }}
      >
        Comenzar {nextRoundName} →
      </button>
    </div>
  );
}

function ChampionScreen({ champion, onRestart }: { champion: DemoTeam; onRestart: () => void }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
      position: "relative",
    }}>
      {/* Glow de fondo */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(124, 58, 237, 0.15), transparent 70%)",
        pointerEvents: "none",
      }} />

      <span style={{
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "4px",
        color: "#fbbf24",
        textTransform: "uppercase",
        marginBottom: "16px",
        zIndex: 1,
      }}>
        🏆 CAMPEÓN DEL TORNEO 🏆
      </span>

      <img
        src={champion.emblemUrl}
        alt={champion.name}
        style={{
          width: "120px",
          height: "120px",
          objectFit: "contain",
          marginBottom: "20px",
          filter: "drop-shadow(0 0 30px rgba(251, 191, 36, 0.4))",
          zIndex: 1,
          animation: "championIn 0.8s cubic-bezier(.22,1,.36,1) both",
        }}
      />

      <h1 style={{
        fontFamily: "Cinzel, serif",
        fontSize: "42px",
        fontWeight: 700,
        letterSpacing: "2px",
        textTransform: "uppercase",
        marginBottom: "8px",
        textShadow: "0 0 30px rgba(251, 191, 36, 0.3)",
        zIndex: 1,
        animation: "championIn 0.8s 0.2s cubic-bezier(.22,1,.36,1) both",
      }}>
        {champion.name}
      </h1>

      <div style={{ fontSize: "14px", color: "#a78bfa", fontStyle: "italic", marginBottom: "24px", zIndex: 1 }}>
        "{champion.tagline}"
      </div>

      <div style={{
        display: "flex",
        gap: "20px",
        marginBottom: "32px",
        zIndex: 1,
      }}>
        {champion.players.map(p => (
          <div key={p.name} style={{
            padding: "8px 16px",
            background: "rgba(124, 58, 237, 0.08)",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            borderRadius: "999px",
            fontSize: "12px",
            color: "#c4b5fd",
          }}>
            {p.isCaptain && "★ "}{p.name}
          </div>
        ))}
      </div>

      <div style={{ fontSize: "13px", color: "#9a92a6", marginBottom: "24px", zIndex: 1 }}>
        ELO: {champion.elo} · 31 partidas jugadas · 5 rondas superadas
      </div>

      <button
        onClick={onRestart}
        style={{
          padding: "14px 32px",
          background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 6px 26px rgba(109, 40, 217, 0.35)",
          zIndex: 1,
        }}
      >
        ↻ Nueva Demo
      </button>

      <Link href="/" style={{
        marginTop: "16px",
        fontSize: "12px",
        color: "#6b6378",
        textDecoration: "none",
        zIndex: 1,
      }}>
        ← Volver al inicio
      </Link>

      <style>{`
        @keyframes championIn {
          from { opacity: 0; transform: scale(0.8) translateY(20px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

function DemoProgressBar({ phase, currentRound, currentMatchIdx, completedMatches, bracket }: any) {
  const roundMatches = bracket[currentRound] ?? [];
  const totalInRound = roundMatches.length;
  const completedInRound = roundMatches.filter((m: DemoMatch) => m.status === "finished").length;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: "rgba(7, 3, 16, 0.92)",
      backdropFilter: "blur(12px)",
      borderTop: "1px solid #1a1424",
      padding: "10px 24px",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      fontSize: "11px",
    }}>
      <span style={{ color: "#7c3aed", fontWeight: 700, letterSpacing: "1px" }}>
        VÉRTIGO DEMO
      </span>
      <span style={{ color: "#6b6378" }}>·</span>
      <span style={{ color: "#9a92a6" }}>
        {ROUND_NAMES[currentRound] ?? "—"}
      </span>
      <span style={{ color: "#6b6378" }}>·</span>
      <span style={{ color: "#9a92a6" }}>
        Match {completedInRound}/{totalInRound}
      </span>
      <span style={{ color: "#6b6378" }}>·</span>
      <span style={{ color: "#9a92a6" }}>
        Total: {completedMatches}/31
      </span>
      <div style={{ flex: 1 }} />
      <span style={{ color: "#a78bfa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>
        {phase.replace(/_/g, " ")}
      </span>
    </div>
  );
}
