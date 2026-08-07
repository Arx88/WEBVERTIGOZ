"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface ConfigMode {
  id: string; title: string; tag: string; color: string; img: string;
  kind: "MODO" | "ANTIMETA" | "FORMATO" | "LLAVE"; tagline: string; description: string; rules: string[];
  mapPool?: "global" | ConfigMap[];
}
export interface ConfigMap {
  id: string;
  title: string;
  tag: string;
  color: string;
  img: string;
  kind: "MAPA";
  tagline: string;
  description: string;
  rules: string[];
}
export interface ConfigState {
  gameModes: ConfigMode[]; antimetaModes: ConfigMode[]; playerModes: ConfigMode[]; mapModes: ConfigMap[]; llaveModes: ConfigMode[];
  music: { enabled: boolean; volume: number };
  sounds: { enabled: boolean; volume: number };
  background: "fondo" | "vortex";
  initialGameModeIndex: number;
  firstRound: boolean;
  epicCards: boolean;
}
const STORAGE_KEY = "vertigo-ruleta-config-v1";
const G = "/modes/game-mode/", A = "/modes/game-mode/antimeta/", P = "/modes/player-mode/";

const DEFAULT_CONFIG: ConfigState = {
  gameModes: [
    { id:"gm-antimeta",title:"ANTIMETA",tag:"CAOS",color:"#ff2e7e",img:G+"antimeta.webp",kind:"MODO",tagline:"El caos reescribe las reglas de la guerra.",description:"Rompe el equilibrio competitivo. El modo Antimeta abandona las estrategias convencionales.",rules:["Configuración extrema al azar","Prohibido repetir estrategias","Sin guías externas","El azar decide las condiciones"]},
    { id:"gm-guerras",title:"GUERRAS IMPERIALES",tag:"ÉPICO",color:"#d8a13f",img:G+"guerras-imperiales.webp",kind:"MODO",tagline:"Guerra total desde el primer segundo.",description:"Comienza en la Edad Imperial y desata el infierno desde el primer segundo.",rules:["Inicio directo en Edad Imperial","Recursos elevados","Tecnologías militares desbloqueadas","Gana quien elimine a todos"]},
    { id:"gm-muerte",title:"MUERTE SÚBITA",tag:"TENSIÓN",color:"#22e5c2",img:G+"muerte-subdita.webp",kind:"MODO",tagline:"El reloj no perdona. Solo el acero decide.",description:"El reloj no perdona. Dispones de un único instante para construir y prepararte.",rules:["Período de preparación limitado","Sin reconstruir edificios clave","Recursos finitos","Solo un sobreviviente"]},
    { id:"gm-regicida",title:"REGICIDA",tag:"REY",color:"#b06bff",img:G+"regicida.webp",kind:"MODO",tagline:"Protege al rey o pierde el reino entero.",description:"El rey es la corona y la corona es todo. Protege a tu monarca o pierde el reino.",rules:["Cada jugador inicia con un Rey","Si el Rey muere, eliminado","El Rey puede refugiarse en castillos","Protege al monarca o pierde todo"]},
  ],
  antimetaModes: [
    { id:"am-500pop",title:"500 POP",tag:"MASIVO",color:"#ff2e7e",img:A+"500pop.webp",kind:"ANTIMETA",tagline:"Ejércitos colosales. Macro sin tregua.",description:"Límite de población disparado a 500. Ejércitos colosales chocan.",rules:["Límite de población: 500","Recursos iniciales elevados","Batallas a escala masiva","Requiere macro intensa"]},
    { id:"am-barcos",title:"BARCOS",tag:"NAVAL",color:"#22e5c2",img:A+"barcos.webp",kind:"ANTIMETA",tagline:"El océano es el único campo de batalla.",description:"El mar es el único campo de batalla. Solo unidades navales.",rules:["Solo unidades navales","Mapa con predominio de agua","Control de rutas marítimas","Prohibidas unidades terrestres"]},
    { id:"am-feudal",title:"FEUDAL",tag:"RÁPIDO",color:"#ff6b00",img:A+"feudal.webp",kind:"ANTIMETA",tagline:"Atascados en el feudal. La micro lo es todo.",description:"Atascados en la Edad Feudal para siempre. Sin avanzar a Castillos.",rules:["Bloqueado en Edad Feudal","Sin unidades de Castillos","Solo tecnologías feudales","Microgestión es la clave"]},
    { id:"am-meso",title:"MESOAMÉRICA",tag:"CULTURA",color:"#d8a13f",img:A+"mesoamerica.webp",kind:"ANTIMETA",tagline:"Selva, sol y civilizaciones precolombinas.",description:"Solo civilizaciones precolombinas: Mayas, Aztecas e Incas.",rules:["Mayas, Aztecas, Incas","Mapas selváticos","Sin caballería tradicional","Unidades únicas precolombinas"]},
    { id:"am-rey",title:"REY DE LA COLINA",tag:"CONTROL",color:"#b06bff",img:A+"rey-de-la-colina.webp",kind:"ANTIMETA",tagline:"Controla la colina o muere intentándolo.",description:"Existe un único punto estratégico: la Colina. Quien la controle, gana.",rules:["Punto central único","Gana quien la controle al final","Alianzas dinámicas","Asedio permanente"]},
    { id:"am-unicas",title:"UNIDADES ÚNICAS",tag:"ÉLITE",color:"#ff5aa5",img:A+"unidades-unicas.webp",kind:"ANTIMETA",tagline:"Solo las élites de cada civilización.",description:"Solo unidades únicas de cada civilización.",rules:["Solo unidades únicas","Castillos obligatorios","Sin unidades estándar","Conocimiento de contras"]},
  ],
  playerModes: [
    { id:"pm-1vs1",title:"1 VS 1",tag:"DUELO",color:"#ff2e7e",img:P+"1vs1.webp",kind:"FORMATO",tagline:"Un duelo de dos mentes estratégicas.",description:"Un duelo directo entre dos mentes estratégicas.",rules:["Un jugador por bando","Sin aliados","Mapa pequeño","Habilidad individual"]},
    { id:"pm-2vs2",title:"2 VS 2",tag:"EQUIPO",color:"#22e5c2",img:P+"2vs2.webp",kind:"FORMATO",tagline:"Dos cabezas piensan mejor que una.",description:"La coordinación con tu compañero se vuelve tan importante como tu habilidad.",rules:["Dos jugadores por bando","Comunicación por voz","Roles divididos","Sincronización de ataques"]},
    { id:"pm-3vs3",title:"3 VS 3",tag:"BATALLA",color:"#d8a13f",img:P+"3vs3.webp",kind:"FORMATO",tagline:"Seis mentes, una sola máquina de guerra.",description:"El 3 vs 3 eleva la complejidad táctica a otro nivel.",rules:["Tres jugadores por bando","Mapa de mayor tamaño","Estrategias de flanco","Economía compartida viable"]},
    { id:"pm-team",title:"TEAM",tag:"GUERRA",color:"#b06bff",img:P+"team.webp",kind:"FORMATO",tagline:"3 jugadores, una sola civilización.",description:"Modo FUSIÓN: los 3 jugadores del equipo manejan juntos una sola civilización, distribuyéndose tareas.",rules:["Tres jugadores, una civ","Sin separar controles","Coordinación total","Distribución de tareas libre"]},
  ],
  music: { enabled: false, volume: 0.2 }, // off por defecto en VÉRTIGO (sobre el sitio sobrio)
  sounds: { enabled: true, volume: 1 },
  background: "fondo",
  initialGameModeIndex: -1,
  firstRound: false,
  epicCards: false,
  llaveModes: [
    { id:"ll-deathmatch",title:"DEATHMATCH",tag:"LLAVE",color:"#ff2e7e",img:"/modes/llave/deathmatch.webp",kind:"LLAVE",tagline:"A muerte: un solo partido decide la llave.",description:"Un solo partido. Quien gana, avanza. Quien pierde, queda eliminado de la llave.",rules:["Un solo partido","Sin ventaja de mapa","Ganador avanza","Eliminación directa"]},
    { id:"ll-bo3",title:"BO3",tag:"LLAVE",color:"#22e5c2",img:"/modes/llave/bo3.webp",kind:"LLAVE",tagline:"Al mejor de 3 partidos.",description:"Serie al mejor de tres: el primero que gane dos partidos se lleva la llave.",rules:["Mejor de 3","Ganar 2 partidos","Ban de mapas","Estrategia por serie"]},
  ],
  mapModes: [
    { id:"map-arabia", title:"ARABIA", tag:"CLÁSICO", color:"#22e5c2", img:"/modes/maps/arabia.webp", kind:"MAPA", tagline:"El clásico mapa abierto.", description:"Arabia es el mapa más jugado de AOE2. Terreno abierto, recursos equilibrados y espacio para expandir.", rules:["Mapa abierto","Recursos equilibrados","Sin obstáculos naturales","Ideal para 1vs1"] },
    { id:"map-arena", title:"ARENA", tag:"CERRADO", color:"#ff2e7e", img:"/modes/maps/arena.webp", kind:"MAPA", tagline:"Bosque cerrado, batallas tempranas.", description:"Arena rodea el mapa de bosque denso. Los jugadores empiezan cerca y las batallas comienzan temprano.", rules:["Bosque perimetral","Inicio cercano","Batallas tempranas","Poca expansión"] },
    { id:"map-atacama", title:"ATACAMA", tag:"DESIERTO", color:"#d8a13f", img:"/modes/maps/atacama.webp", kind:"MAPA", tagline:"El desierto más árido exige control total.", description:"Atacama es un mapa desértico y abierto con rutas de expansión agresivas.", rules:["Terreno abierto","Pocos recursos cercanos","Control del centro","Empujes agresivos"] },
    { id:"map-crater", title:"CRÁTER", tag:"ALTURAS", color:"#ff6b00", img:"/modes/maps/crater.webp", kind:"MAPA", tagline:"La batalla por el centro lo decide todo.", description:"Crater concentra los recursos en el centro del mapa. Quien domine el cráter controla la partida.", rules:["Recursos centrales","Control del cráter","Asedio constante","Pocas rutas de escape"] },
    { id:"map-cresta", title:"CRESTA MONTAÑOSA", tag:"MONTAÑA", color:"#b06bff", img:"/modes/maps/cresta-montanosa.webp", kind:"MAPA", tagline:"Colinas y cuellos de botella.", description:"La cresta montañosa divide el mapa con terreno elevado y pasos estrechos.", rules:["Terreno elevado","Cuellos de botella","Ventaja con arqueros","Control de pasos"] },
    { id:"map-cuatro-lagos", title:"CUATRO LAGOS", tag:"NAVAL", color:"#22e5c2", img:"/modes/maps/cuatro-lagos.webp", kind:"MAPA", tagline:"El agua cruza el campo de batalla.", description:"Cuatro lagos reparten el mapa en islas de tierra. Flota y tierra firme se combinan.", rules:["Mapa con agua","Control naval","Desembarcos","Recursos en islas"] },
    { id:"map-cuenca-oro", title:"CUENCA DEL ORO", tag:"ORO", color:"#d8a13f", img:"/modes/maps/cuenca-del-oro.webp", kind:"MAPA", tagline:"El oro decide quién domina.", description:"La cuenca del oro concentra el metal más valioso en zonas disputadas.", rules:["Oro abundante","Minas disputadas","Escaramuzas tempranas","Economía clave"] },
    { id:"map-migracion", title:"MIGRACIÓN", tag:"NÓMADA", color:"#ff5aa5", img:"/modes/maps/migracion.webp", kind:"MAPA", tagline:"Comienzas sin pueblo, eliges tu destino.", description:"En Migración los jugadores inician sin centro urbano y deben trasladarse para fundar su imperio.", rules:["Inicio nómada","Mover el centro urbano","Elegir posición","Exploración vital"] },
    { id:"map-tormenta", title:"TORMENTA DE POLVO", tag:"DESIERTO", color:"#ff6b00", img:"/modes/maps/tormenta-de-polvo.webp", kind:"MAPA", tagline:"La tormenta oculta tus movimientos.", description:"La tormenta de polvo reduce la visibilidad y obliga a jugar con intuición y riesgo.", rules:["Visibilidad reducida","Exploración arriesgada","Ataques sorpresa","Adaptación constante"] },
  ],
};

interface ConfigContextValue { config: ConfigState; setConfig: (u: (p: ConfigState) => ConfigState) => void; resetConfig: () => void; }
const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<ConfigState>(() => {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const pick = (k: "gameModes" | "antimetaModes" | "playerModes" | "mapModes" | "llaveModes") =>
          Array.isArray(p[k]) && p[k].length ? p[k] : DEFAULT_CONFIG[k];
        return {
          ...DEFAULT_CONFIG,
          ...p,
          music: { ...DEFAULT_CONFIG.music, ...p.music },
          sounds: { ...DEFAULT_CONFIG.sounds, ...p.sounds },
          gameModes: pick("gameModes"),
          antimetaModes: pick("antimetaModes"),
          playerModes: pick("playerModes"),
          mapModes: pick("mapModes"),
          llaveModes: pick("llaveModes"),
        };
      }
    } catch {}
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
  }, [config]);

  const setConfig = (u: (p: ConfigState) => ConfigState) => setConfigState(u);
  const resetConfig = () => {
    setConfigState(DEFAULT_CONFIG);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <ConfigContext.Provider value={{ config, setConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const c = useContext(ConfigContext);
  if (!c) throw new Error("useConfig must be used within ConfigProvider");
  return c;
}

export function generateModeId(prefix = "mode"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
