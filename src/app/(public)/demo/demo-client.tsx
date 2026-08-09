"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ALL_REINOS } from "@/lib/constants/emblems";
import { CIV_NAMES, civName } from "@/lib/constants/civs";

// ============================================================
// DATA
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

const GAME_MODES = [
  { name: "ANTIMETA", color: "#ff2e7e", img: "/modes/game-mode/antimeta.webp" },
  { name: "GUERRAS IMPERIALES", color: "#d8a13f", img: "/modes/game-mode/guerras-imperiales.webp" },
  { name: "MUERTE SÚBITA", color: "#22e5c2", img: "/modes/game-mode/muerte-subdita.webp" },
  { name: "REGICIDA", color: "#b06bff", img: "/modes/game-mode/regicida.webp" },
];

const ANTIMETAS = [
  { name: "500 POP", color: "#ff2e7e", img: "/modes/game-mode/antimeta/500pop.webp" },
  { name: "BARCOS", color: "#22e5c2", img: "/modes/game-mode/antimeta/barcos.webp" },
  { name: "FEUDAL", color: "#ff6b00", img: "/modes/game-mode/antimeta/feudal.webp" },
  { name: "MESOAMÉRICA", color: "#d8a13f", img: "/modes/game-mode/antimeta/mesoamerica.webp" },
  { name: "REY DE LA COLINA", color: "#b06bff", img: "/modes/game-mode/antimeta/rey-de-la-colina.webp" },
  { name: "UNIDADES ÚNICAS", color: "#ff5aa5", img: "/modes/game-mode/antimeta/unidades-unicas.webp" },
];

const PLAYER_MODES = [
  { name: "1 VS 1", color: "#ff2e7e", img: "/modes/player-mode/1vs1.webp" },
  { name: "2 VS 2", color: "#22e5c2", img: "/modes/player-mode/2vs2.webp" },
  { name: "3 VS 3", color: "#d8a13f", img: "/modes/player-mode/3vs3.webp" },
  { name: "TEAM", color: "#b06bff", img: "/modes/player-mode/team.webp" },
];

const MAPS = [
  { name: "ARABIA", color: "#22e5c2", img: "/modes/maps/arabia.webp" },
  { name: "ARENA", color: "#ff2e7e", img: "/modes/maps/arena.webp" },
  { name: "ATACAMA", color: "#d8a13f", img: "/modes/maps/atacama.webp" },
  { name: "CRÁTER", color: "#ff6b00", img: "/modes/maps/crater.webp" },
  { name: "CRESTA MONTAÑOSA", color: "#b06bff", img: "/modes/maps/cresta-montanosa.webp" },
  { name: "CUATRO LAGOS", color: "#22e5c2", img: "/modes/maps/cuatro-lagos.webp" },
  { name: "CUENCA DEL ORO", color: "#d8a13f", img: "/modes/maps/cuenca-del-oro.webp" },
  { name: "MIGRACIÓN", color: "#ff5aa5", img: "/modes/maps/migracion.webp" },
  { name: "TORMENTA DE POLVO", color: "#ff6b00", img: "/modes/maps/tormenta-de-polvo.webp" },
];

const LLAVE_FORMATS = [
  { name: "DEATHMATCH", color: "#ff2e7e", img: "/modes/llave/deathmatch.webp" },
  { name: "BO3", color: "#22e5c2", img: "/modes/llave/bo3.webp" },
];

const CIV_KEYS = Object.keys(CIV_NAMES);
const ROUND_NAMES = ["Ronda 1", "Octavos", "Cuartos", "Semifinal", "Final"];

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

interface DemoTeam {
  id: string;
  name: string;
  tagline: string;
  emblemUrl: string;
  elo: number;
  players: { name: string; elo: number; isCaptain: boolean }[];
  civPool: string[];
}

function generateTeams(): DemoTeam[] {
  return TEAM_NAMES.map((name, i) => {
    const reino = ALL_REINOS[i % ALL_REINOS.length];
    const players = Array.from({ length: 3 }, (_, j) => {
      const nameIdx = (i * 3 + j) % PLAYER_NAMES.length;
      return {
        name: PLAYER_NAMES[nameIdx],
        elo: 800 + Math.floor(Math.random() * 600),
        isCaptain: j === 0,
      };
    });
    return {
      id: `team-${i + 1}`,
      name,
      tagline: randomFrom(TAGLINES),
      emblemUrl: reino.img,
      elo: players.reduce((s, p) => s + p.elo, 0),
      players,
      civPool: randomCivs(9),
    };
  });
}

// ============================================================
// FASES DEL DEMO
// ============================================================

type Phase = "intro" | "teams" | "seeding" | "bracket" | "match_intro" | "sorteo" | "comodines" | "resultado" | "campeon";

export default function DemoClient() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [teams] = useState<DemoTeam[]>(() => generateTeams());
  const [sorteoStep, setSorteoStep] = useState(0); // 0=modo, 1=antimeta, 2=formato, 3=mapa, 4=civs, 5=llave, 6=done
  const [sorteoData, setSorteoData] = useState<any>(null);
  const [comodinEvent, setComodinEvent] = useState<string | null>(null);
  const [winner, setWinner] = useState<DemoTeam | null>(null);

  // Sorteo paso a paso
  const startSorteo = () => {
    const teamA = teams[0];
    const teamB = teams[1];
    const gameMode = randomFrom(GAME_MODES);
    const antimeta = gameMode.name === "ANTIMETA" ? randomFrom(ANTIMETAS) : null;
    const playerMode = randomFrom(PLAYER_MODES);
    const map = randomFrom(MAPS);
    const llaveFormat = randomFrom(LLAVE_FORMATS);

    let civCount = 1;
    if (playerMode.name === "2 VS 2") civCount = 2;
    else if (playerMode.name === "3 VS 3") civCount = 3;

    setSorteoData({
      teamA, teamB, gameMode, antimeta, playerMode, map, llaveFormat,
      civsA: randomCivs(civCount, teamA.civPool),
      civsB: randomCivs(civCount, teamB.civPool),
    });
    setSorteoStep(0);
    setPhase("sorteo");
  };

  // Avanzar paso del sorteo
  const nextSorteoStep = () => {
    if (sorteoStep < 6) {
      setSorteoStep(s => s + 1);
    } else {
      setPhase("comodines");
    }
  };

  // Simular comodín
  const simulateComodin = () => {
    const useComodin = Math.random() < 0.5;
    if (useComodin) {
      const types = [
        `${sorteoData.teamA.name} usa RE-GIRAR — el mapa cambia a ${randomFrom(MAPS.filter(m => m.name !== sorteoData.map.name)).name}`,
        `${sorteoData.teamB.name} usa ANULAR JUGADOR — obliga al rival a sacar a un jugador`,
        `${sorteoData.teamA.name} usa ELEGIR RIVAL — elige quién juega del rival`,
      ];
      setComodinEvent(randomFrom(types));
    } else {
      setComodinEvent(null);
    }
    setPhase("resultado");
  };

  // Determinar ganador
  const finishMatch = () => {
    const teamAWins = Math.random() < 0.5;
    const w = teamAWins ? sorteoData.teamA : sorteoData.teamB;
    setWinner(w);
    setPhase("campeon");
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070310",
      backgroundImage: `
        radial-gradient(900px 520px at 12% 8%, rgba(88, 28, 175, .16), transparent 60%),
        radial-gradient(800px 500px at 88% 85%, rgba(124, 58, 237, .10), transparent 60%)
      `,
      color: "#f2eef7",
      fontFamily: "Inter, system-ui, sans-serif",
      overflowX: "hidden",
    }}>
      {/* INTRO */}
      {phase === "intro" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", textAlign: "center" }}>
          <img src="/landing/logo.png" alt="VÉRTIGO" style={{ width: "100px", marginBottom: "24px" }} />
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "12px" }}>DEMO INTERACTIVA</span>
          <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "42px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px", textShadow: "0 0 30px rgba(124,58,237,.4)" }}>VÉRTIGO Cup</h1>
          <Divider />
          <p style={{ fontSize: "15px", color: "#9a92a6", maxWidth: "500px", lineHeight: 1.7, marginBottom: "28px" }}>
            Así se vería el torneo en stream: 32 equipos, sorteo con ruleta, comodines, bracket y campeón.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => setPhase("teams")} style={btnPrimary}>Ver Demo →</button>
            <Link href="/ruleta/demo" style={btnGhost}>Ver Ruleta Real</Link>
          </div>
          <Link href="/" style={{ marginTop: "20px", fontSize: "12px", color: "#6b6378", textDecoration: "none" }}>← Volver</Link>
        </div>
      )}

      {/* EQUIPOS */}
      {phase === "teams" && (
        <div style={{ minHeight: "100vh", padding: "40px" }}>
          <Kicker label="EQUIPOS" />
          <Title>32 Equipos inscriptos</Title>
          <Divider />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", maxWidth: "900px", margin: "0 auto" }}>
            {teams.map((t, i) => (
              <div key={t.id} style={{
                padding: "14px",
                background: "rgba(13,9,19,.6)",
                border: "1px solid #1a1424",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                animation: `fadeUp .4s cubic-bezier(.22,1,.36,1) both`,
                animationDelay: `${i * 0.03}s`,
              }}>
                <img src={t.emblemUrl} alt="" style={{ width: "36px", height: "36px", objectFit: "contain", flex: "none" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                  <div style={{ fontSize: "10px", color: "#6b6378" }}>ELO {t.elo}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <button onClick={() => setPhase("seeding")} style={btnPrimary}>Sortear Bracket →</button>
          </div>
        </div>
      )}

      {/* SEEDING */}
      {phase === "seeding" && (
        <SeedingAnimation teams={teams} onDone={() => setPhase("bracket")} />
      )}

      {/* BRACKET */}
      {phase === "bracket" && (
        <div style={{ minHeight: "100vh", padding: "40px" }}>
          <Kicker label="BRACKET" />
          <Title>Bracket generado</Title>
          <Divider />
          <BracketView teams={teams} />
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <button onClick={() => setPhase("match_intro")} style={btnPrimary}>Ver primer match →</button>
          </div>
        </div>
      )}

      {/* MATCH INTRO */}
      {phase === "match_intro" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
          <Kicker label="RONDA 1 · MATCH 1" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "40px", alignItems: "center", maxWidth: "700px", width: "100%" }}>
            <TeamBig team={teams[0]} side="left" />
            <div style={{ fontFamily: "Cinzel, serif", fontSize: "48px", fontWeight: 700, color: "#7c3aed", textShadow: "0 0 20px rgba(124,58,237,.4)" }}>VS</div>
            <TeamBig team={teams[1]} side="right" />
          </div>
          <button onClick={startSorteo} style={{ ...btnPrimary, marginTop: "48px", fontSize: "14px" }}>🎰 Tirar Ruleta</button>
        </div>
      )}

      {/* SORTEO — paso a paso, replicando la estética de la ruleta */}
      {phase === "sorteo" && sorteoData && (
        <SorteoStepByStep
          data={sorteoData}
          step={sorteoStep}
          onNext={nextSorteoStep}
        />
      )}

      {/* COMODINES */}
      {phase === "comodines" && sorteoData && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
          <Kicker label="⚡ VENTANA DE COMODINES" />
          <Title>T-05:00 restantes</Title>
          <Divider />
          <div style={{ padding: "24px", background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.3)", borderRadius: "12px", maxWidth: "460px", textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎴</div>
            <div style={{ fontSize: "14px", color: "#fbbf24", fontWeight: 600 }}>
              Los capitanes pueden usar comodines:<br />Re-girar, Anular jugador, Elegir rival
            </div>
          </div>
          <button onClick={simulateComodin} style={btnPrimary}>Simular comodines →</button>
        </div>
      )}

      {/* RESULTADO */}
      {phase === "resultado" && sorteoData && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
          <Kicker label="PARTIDA FINALIZADA" />
          {comodinEvent && (
            <div style={{ padding: "12px 20px", background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.3)", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", color: "#fbbf24" }}>
              🎴 {comodinEvent}
            </div>
          )}
          {/* Scoreboard */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "32px", alignItems: "center", maxWidth: "700px", width: "100%" }}>
            <div style={{ textAlign: "center" }}>
              <img src={sorteoData.teamA.emblemUrl} alt="" style={{ width: "64px", height: "64px", objectFit: "contain", marginBottom: "8px" }} />
              <div style={{ fontFamily: "Cinzel, serif", fontSize: "16px", fontWeight: 700 }}>{sorteoData.teamA.name}</div>
            </div>
            <div style={{ fontFamily: "Cinzel, serif", fontSize: "48px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {sorteoData.llaveFormat.name === "BO3" ? "2-1" : "1-0"}
            </div>
            <div style={{ textAlign: "center" }}>
              <img src={sorteoData.teamB.emblemUrl} alt="" style={{ width: "64px", height: "64px", objectFit: "contain", marginBottom: "8px" }} />
              <div style={{ fontFamily: "Cinzel, serif", fontSize: "16px", fontWeight: 700 }}>{sorteoData.teamB.name}</div>
            </div>
          </div>
          <button onClick={finishMatch} style={{ ...btnPrimary, marginTop: "40px" }}>Ver Campeón →</button>
        </div>
      )}

      {/* CAMPEÓN */}
      {phase === "campeon" && winner && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", position: "relative" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(251,191,36,.12), transparent 70%)", pointerEvents: "none" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "4px", color: "#fbbf24", textTransform: "uppercase", marginBottom: "16px", zIndex: 1 }}>🏆 CAMPEÓN 🏆</span>
          <img src={winner.emblemUrl} alt="" style={{ width: "100px", height: "100px", objectFit: "contain", marginBottom: "16px", filter: "drop-shadow(0 0 25px rgba(251,191,36,.4))", zIndex: 1 }} />
          <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "36px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px", textShadow: "0 0 25px rgba(251,191,36,.3)", zIndex: 1 }}>{winner.name}</h1>
          <div style={{ fontSize: "13px", color: "#a78bfa", fontStyle: "italic", marginBottom: "20px", zIndex: 1 }}>"{winner.tagline}"</div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "28px", zIndex: 1 }}>
            {winner.players.map(p => (
              <span key={p.name} style={{ padding: "6px 14px", background: "rgba(124,58,237,.08)", border: "1px solid rgba(124,58,237,.2)", borderRadius: "999px", fontSize: "12px", color: "#c4b5fd" }}>
                {p.isCaptain && "★ "}{p.name}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "12px", zIndex: 1 }}>
            <button onClick={() => { setPhase("intro"); setWinner(null); }} style={btnPrimary}>↻ Nueva Demo</button>
            <Link href="/ruleta/demo" style={btnGhost}>Ver Ruleta</Link>
            <Link href="/" style={btnGhost}>Inicio</Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTES
// ============================================================

const btnPrimary: React.CSSProperties = {
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
  boxShadow: "0 6px 26px rgba(109,40,217,.35)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};

const btnGhost: React.CSSProperties = {
  padding: "16px 28px",
  background: "transparent",
  color: "#b7b0c2",
  border: "1px solid #322a3e",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "2px",
  textTransform: "uppercase",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};

function Kicker({ label }: { label: string }) {
  return <span style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "8px", textAlign: "center" }}>{label}</span>;
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "28px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", textAlign: "center", marginBottom: "8px" }}>{children}</h1>;
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", margin: "12px 0 24px" }}>
      <span style={{ width: 100, height: 1, background: "linear-gradient(90deg, transparent, #3a2f4a)" }} />
      <span style={{ width: 7, height: 7, border: "1px solid #a78bfa", transform: "rotate(45deg)" }} />
      <span style={{ width: 100, height: 1, background: "linear-gradient(90deg, #3a2f4a, transparent)" }} />
    </div>
  );
}

function TeamBig({ team, side }: { team: DemoTeam; side: "left" | "right" }) {
  return (
    <div style={{ textAlign: side === "left" ? "right" : "left" }}>
      <img src={team.emblemUrl} alt="" style={{ width: "80px", height: "80px", objectFit: "contain", marginBottom: "12px", marginLeft: side === "right" ? "auto" : "0", marginRight: side === "left" ? "auto" : "0", display: "block", filter: "drop-shadow(0 4px 12px rgba(124,58,237,.2))" }} />
      <div style={{ fontSize: "11px", color: "#a78bfa", fontWeight: 700 }}>ELO {team.elo}</div>
      <h2 style={{ fontFamily: "Cinzel, serif", fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>{team.name}</h2>
      <div style={{ fontSize: "12px", color: "#6b6378", fontStyle: "italic" }}>"{team.tagline}"</div>
      <div style={{ fontSize: "11px", color: "#9a92a6", marginTop: "8px" }}>{team.players.map(p => p.name).join(" · ")}</div>
    </div>
  );
}

// ============================================================
// SEEDING ANIMATION
// ============================================================

function SeedingAnimation({ teams, onDone }: { teams: DemoTeam[]; onDone: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (revealed >= 32) {
      setDone(true);
      const t = setTimeout(onDone, 1500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealed(r => r + 1), 60);
    return () => clearTimeout(t);
  }, [revealed, onDone]);

  return (
    <div style={{ minHeight: "100vh", padding: "40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Kicker label="SORTEO INICIAL" />
      <Title>Asignando seeds...</Title>
      <Divider />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "10px", maxWidth: "850px", width: "100%" }}>
        {teams.map((t, i) => {
          const isRevealed = i < revealed;
          return (
            <div key={t.id} style={{
              padding: "12px",
              background: isRevealed ? "rgba(124,58,237,.08)" : "rgba(13,9,19,.4)",
              border: `1px solid ${isRevealed ? "rgba(124,58,237,.3)" : "#1a1424"}`,
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              opacity: isRevealed ? 1 : 0.3,
              transition: "all .3s",
            }}>
              {isRevealed ? (
                <>
                  <img src={t.emblemUrl} alt="" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "10px", color: "#a78bfa", fontWeight: 700 }}>SEED #{i + 1}</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "12px", color: "#6b6378" }}>???</div>
              )}
            </div>
          );
        })}
      </div>
      {done && <div style={{ marginTop: "24px", color: "#22c55e", fontWeight: 700 }}>✓ Seeds asignados</div>}
    </div>
  );
}

// ============================================================
// BRACKET VIEW (solo R1 visible)
// ============================================================

function BracketView({ teams }: { teams: DemoTeam[] }) {
  // Mostrar R1 con los primeros 32 teams en orden de seed
  const r1 = Array.from({ length: 16 }, (_, i) => ({
    teamA: teams[i * 2],
    teamB: teams[i * 2 + 1],
  }));

  return (
    <div style={{ overflowX: "auto", paddingBottom: "16px" }}>
      <div style={{ display: "flex", gap: "20px", minWidth: "max-content", justifyContent: "center" }}>
        {/* R1 */}
        <div style={{ minWidth: "200px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#a78bfa", marginBottom: "10px", borderBottom: "1px solid #241d2f", paddingBottom: "6px" }}>Ronda 1</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {r1.map((m, i) => (
              <div key={i} style={{ padding: "8px 10px", background: "rgba(13,9,19,.6)", border: "1px solid #1a1424", borderRadius: "8px", fontSize: "11px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <img src={m.teamA.emblemUrl} alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
                  <span style={{ color: "#9a92a6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m.teamA.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                  <img src={m.teamB.emblemUrl} alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
                  <span style={{ color: "#9a92a6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m.teamB.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* R2-R5 vacíos */}
        {[1, 2, 3, 4].map(r => (
          <div key={r} style={{ minWidth: "180px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#6b6378", marginBottom: "10px", borderBottom: "1px solid #1a1424", paddingBottom: "6px" }}>{ROUND_NAMES[r]}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Array.from({ length: 16 / Math.pow(2, r) }).map((_, i) => (
                <div key={i} style={{ padding: "8px 10px", background: "rgba(13,9,19,.3)", border: "1px solid #1a1424", borderRadius: "8px", fontSize: "11px", color: "#3a3049", textAlign: "center" }}>
                  Por definir
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SORTEO PASO A PASO — replica la estética de la ruleta
// ============================================================

function SorteoStepByStep({ data, step, onNext }: { data: any; step: number; onNext: () => void }) {
  const steps = [
    { label: "MODO DE JUEGO", item: data.gameMode, show: true },
    { label: "ANTIMETA", item: data.antimeta, show: data.antimeta != null },
    { label: "FORMATO", item: data.playerMode, show: true },
    { label: "MAPA", item: data.map, show: true },
    { label: "CIVILIZACIONES", item: { civsA: data.civsA, civsB: data.civsB }, show: true, isCivs: true },
    { label: "FORMATO DE LLAVE", item: data.llaveFormat, show: true },
  ];

  // Filtrar pasos que no aplican (antimeta solo si gameMode es ANTIMETA)
  const visibleSteps = steps.filter(s => s.show);
  const currentStepData = visibleSteps[step];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
      {/* Header del match */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        padding: "12px 24px", background: "rgba(7,3,16,.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1a1424",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img src={data.teamA.emblemUrl} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
          <span style={{ fontSize: "13px", fontWeight: 600 }}>{data.teamA.name}</span>
        </div>
        <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "2px", color: "#fbbf24", textTransform: "uppercase", animation: "pulse 1.5s infinite" }}>
          🎰 SORTEANDO...
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>{data.teamB.name}</span>
          <img src={data.teamB.emblemUrl} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
        </div>
      </div>

      {/* Paso actual */}
      {currentStepData && !currentStepData.isCivs && currentStepData.item && (
        <div style={{ textAlign: "center", animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "20px" }}>
            {currentStepData.label}
          </div>
          <img
            src={currentStepData.item.img}
            alt={currentStepData.item.name}
            style={{
              width: "200px", height: "200px", objectFit: "contain", marginBottom: "20px",
              filter: `drop-shadow(0 8px 30px ${currentStepData.item.color}44)`,
              animation: "cardLand .6s cubic-bezier(.22,1,.36,1) both",
            }}
          />
          <h2 style={{
            fontFamily: "Cinzel, serif", fontSize: "32px", fontWeight: 700,
            letterSpacing: "2px", textTransform: "uppercase",
            color: currentStepData.item.color,
            textShadow: `0 0 20px ${currentStepData.item.color}44`,
          }}>
            {currentStepData.item.name}
          </h2>
        </div>
      )}

      {/* Civs */}
      {currentStepData?.isCivs && (
        <div style={{ textAlign: "center", animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "20px" }}>CIVILIZACIONES</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "600px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#9a92a6", marginBottom: "10px" }}>{data.teamA.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.civsA.map((c: string, i: number) => (
                  <div key={c} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px", background: "rgba(124,58,237,.08)",
                    border: "1px solid rgba(124,58,237,.2)", borderRadius: "8px",
                    animation: `fadeUp .4s cubic-bezier(.22,1,.36,1) both`,
                    animationDelay: `${i * 0.1}s`,
                  }}>
                    <img src={`/civs/${c}.webp`} alt="" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{civName(c)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#9a92a6", marginBottom: "10px" }}>{data.teamB.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.civsB.map((c: string, i: number) => (
                  <div key={c} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px", background: "rgba(124,58,237,.08)",
                    border: "1px solid rgba(124,58,237,.2)", borderRadius: "8px",
                    animation: `fadeUp .4s cubic-bezier(.22,1,.36,1) both`,
                    animationDelay: `${i * 0.1}s`,
                  }}>
                    <img src={`/civs/${c}.webp`} alt="" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{civName(c)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultados anteriores (mini) */}
      {step > 0 && (
        <div style={{
          display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center",
          marginTop: "32px", maxWidth: "600px",
        }}>
          {visibleSteps.slice(0, step).map((s, i) => (
            <div key={i} style={{
              padding: "6px 12px", background: "rgba(13,9,19,.6)",
              border: "1px solid #1a1424", borderRadius: "8px",
              fontSize: "11px", display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span style={{ color: "#6b6378" }}>{s.label}:</span>
              <span style={{ color: s.item?.color ?? "#9a92a6", fontWeight: 600 }}>
                {s.isCivs ? `${s.item.civsA.length} civs` : s.item?.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Botón continuar */}
      <button onClick={onNext} style={{ ...btnPrimary, marginTop: "32px" }}>
        {step < visibleSteps.length - 1 ? "Siguiente →" : "Continuar →"}
      </button>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: "6px", marginTop: "20px" }}>
        {visibleSteps.map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: i <= step ? "#7c3aed" : "#241d2f",
            transition: "all .3s",
          }} />
        ))}
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: none; } }
        @keyframes cardLand { 0% { opacity: 0; transform: scale(.8) translateY(-20px); } 60% { transform: scale(1.05) translateY(0); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
      `}</style>
    </div>
  );
}
