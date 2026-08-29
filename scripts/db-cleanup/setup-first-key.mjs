/**
 * ARMA LA PRIMERA LLAVE DEL TORNEO.
 *  - Resetea el match de 'finished' → 'open' (sin ganador, 0-0).
 *  - Limpia las partidas 2/3 de los tests.
 *  - Partida 1 en 'drawing' con roulette_draw YA REVELADO: mapa Arabia + 1v1.
 *  - Lineups: team A (PSX) → PSX | Eman ; team B (PAPÁ de cristian) → PSX | DP11A.
 *  - El match queda en 'open' (el admin avanza la fase manualmente desde la stream).
 */
import { connectDb } from "./connect.mjs";
import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";

const MATCH = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";
const GAME1 = "bfc4d803-cec2-4f81-8e39-24f6e2cf0c02";
const PRESET = "0de1e2cb-c8c2-4e2a-9d02-ee7d718b5fec";
const ADMIN_ACCOUNT = "a6600514-2644-4247-9fc1-297d4531dd99"; // admin de los draws existentes
const EMAN = "1610024e-2c1f-4ecc-b5d2-215e72eb46ef";   // PSX | Eman   → team A (PSX)
const DP11A = "7e0b2b20-914b-4d24-b376-090c24a50412";  // PSX | DP11A  → team B (PAPÁ)
// civs para 1v1 (una por bando)
const CIVS_A = ["magyars"];
const CIVS_B = ["britons"];

const client = await connectDb();
const q = (t, p) => client.query(t, p);

const seed = randomBytes(32).toString("hex");
const drawnAt = new Date().toISOString();
const commitHash = createHash("sha256").update(`${seed}|${MATCH}|1|${drawnAt}`).digest("hex");

// Objetos de la config (copiados de src/lib/ruleta/config.tsx + mode objects del preset)
const gameMode = {
  id:"gm-guerras",title:"GUERRAS IMPERIALES",tag:"ÉPICO",color:"#d8a13f",img:"/modes/game-mode/guerras-imperiales.webp",kind:"MODO",
  tagline:"Guerra total desde el primer segundo.",description:"Comienza en la Edad Imperial y desata el infierno desde el primer segundo.",
  rules:["Inicio directo en Edad Imperial","Recursos elevados","Tecnologías militares desbloqueadas","Gana quien elimine a todos"],
};
const playerMode = {
  id:"pm-1vs1",title:"1 VS 1",tag:"DUELO",color:"#ff2e7e",img:"/modes/player-mode/1vs1.webp",kind:"FORMATO",
  tagline:"Un duelo de dos mentes estratégicas.",description:"Un duelo directo entre dos mentes estratégicas.",
  rules:["Un jugador por bando","Sin aliados","Mapa pequeño","Habilidad individual"], civsPerTeam:1,
};
const map = {
  id:"map-arabia", title:"ARABIA", tag:"CLÁSICO", color:"#22e5c2", img:"/modes/maps/arabia.webp", kind:"MAPA",
  tagline:"El clásico mapa abierto.", description:"Arabia es el mapa más jugado de AOE2. Terreno abierto, recursos equilibrados y espacio para expandir.",
  rules:["Mapa abierto","Recursos equilibrados","Sin obstáculos naturales","Ideal para 1vs1"],
};
const llave = {
  id:"ll-bo3",title:"BO3",tag:"LLAVE",color:"#22e5c2",img:"/modes/llave/bo3.webp",kind:"LLAVE",
  tagline:"Al mejor de 3 partidos.",description:"Serie al mejor de tres: el primero que gane dos partidos se lleva la llave.",
  rules:["Mejor de 3","Ganar 2 partidos","Ban de mapas","Estrategia por serie"], llaveFormat:"BO3",
};

const result = {
  gameMode, antimetaMode: null, playerMode, map,
  llaveFormat: llave.llaveFormat, llave,
  civsA: CIVS_A, civsB: CIVS_B, seed, drawnAt,
};

// 1) Reset match: finished → open
await q(`UPDATE "match" SET
    status='open', winner_team_id=NULL, score_a=0, score_b=0,
    finished_at=NULL, draw_seed=$1,
    ready_lineup_a_at=NULL, ready_lineup_b_at=NULL, comodin_window_expires_at=NULL,
    updated_at=now()
  WHERE id=$2`, [seed, MATCH]);

// 2) Eliminar partidas 2/3 (relleno de tests) y sus draws
const del = await q(`DELETE FROM match_game WHERE match_id=$1 AND game_number IN (2,3)`, [MATCH]);
console.log(`match_games extra borradas: ${del.rowCount}`);

// 3) Cancelar borrando draws viejos de la partida 1 (cascade borra audit log)
const oldDraws = await q(`DELETE FROM roulette_draw WHERE match_game_id=$1`, [GAME1]);
console.log(`draws viejos borrados: ${oldDraws.rowCount}`);

// 4) Insertar el draw revelado de Arabia 1v1
const { rows: [drawRow] } = await q(
  `INSERT INTO roulette_draw
    (match_game_id, admin_id, status, commit_hash, revealed_seed, public_inputs, preset_version_id,
     committed_at, spinning_at, revealed_at, result)
   VALUES ($1,$2,'revealed',$3,$4,$5,$6,$7,$7,$7,$8)
   RETURNING id`,
  [GAME1, ADMIN_ACCOUNT, commitHash, seed,
   JSON.stringify({ match_id: MATCH, game_number: 1, preset_version_id: PRESET, timestamp: drawnAt }),
   PRESET, drawnAt, result]
);

// 5) Partida 1: drawing + salida sorteo + lineups
await q(
  `UPDATE match_game SET
     draw_id=$1, status='drawing',
     game_mode=$2, antimeta_mode=NULL, player_mode='1v1', map='ARABIA',
     llave_format='BO3', civs_a=$3, civs_b=$4,
     lineup_a=$5, lineup_b=$6,
     winner_team_id=NULL, replay_url=NULL, started_at=NULL, finished_at=NULL,
     aoe2_match_id=NULL, aoe2_sync_status='pending', aoe2_checked_at=NULL, aoe2_flag=NULL, rec_storage_path=NULL,
     updated_at=now()
   WHERE id=$7`,
  [drawRow.id, gameMode.title, JSON.stringify(CIVS_A), JSON.stringify(CIVS_B),
   JSON.stringify([EMAN]), JSON.stringify([DP11A]), GAME1]
);

console.log("\n✓ PRIMERA LLAVE ARREGLAADA");
console.log(`  Match: open | Partida 1: drawing (draw revelado: ${drawRow.id})`);
console.log("  Mapa: ARABIA · Formato: 1v1 · Llave: BO3");
console.log(`  PSX       → ${EMAN}`);
console.log(`  PAPÁ      → ${DP11A}`);
console.log(`  Lineup A: ${JSON.stringify([EMAN])}`);
console.log(`  Lineup B: ${JSON.stringify([DP11A])}`);
await client.end();