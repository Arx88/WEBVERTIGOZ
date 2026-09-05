"use client";

/**
 * PowerCardStage — el momento de stream donde una CARTA DE PODER cae sobre
 * un jugador (ANULAR lo saca; ELEGIR RIVAL lo impone).
 *
 * ELEGIR RIVAL es MUTUO: ambos equipos juegan la carta y cada uno impone un
 * jugador del rival — en modo duelo (duel) la escena muestra los DOS rosters
 * enfrentados (mi lado izquierdo, el rival a la derecha), cada uno con su
 * víctima marcada. En modo simple (1 carta) es una sola fila de unidades.
 *
 * Pantalla de selección de personaje: cada jugador es una UNIDAD (glifo de
 * diamante + nombre grande bien espaciado), flotando libre sobre el fondo.
 * La víctima crece, se prende del color de la carta y recibe la marca —
 * zarpazo rojo (ANULAR) o retícula dorada de lock-on (ELEGIR RIVAL) —
 * mientras los demás quedan lejos y apagados. La carta flota arriba.
 *
 * takeover=true (overlay real de OBS): la escena se toma la pantalla completa
 * mientras los equipos afectados re-declaran su lineup.
 *
 * Estilos en tutorial.css (bloque pk-moment). Colores por carta vía
 * data-kind: ANULAR rojo, ELEGIR RIVAL dorado.
 */

export type PowerCardKind = "anular" | "elegir_rival";

export function powerCardMeta(kind: PowerCardKind): { img: string; name: string; verb: string } {
  return kind === "anular"
    ? { img: "/brand/icons/comodin-anular.png", name: "ANULAR", verb: "FUERA DE ESTA LLAVE" }
    : { img: "/brand/icons/comodin-elegir.png", name: "ELEGIR RIVAL", verb: "OBLIGADO A JUGAR" };
}

/** Subtítulo único: qué significa la escena (1 línea, toda la regla). */
function subtitleFor(isDuel: boolean, duelKind: PowerCardKind | null, kind: PowerCardKind): string {
  if (!isDuel) return powerCardMeta(kind).verb;
  if (duelKind === kind) return kind === "anular" ? "CADA EQUIPO SACA A UN JUGADOR" : "CADA EQUIPO IMPONE UN JUGADOR";
  return "UNA CARTA POR EQUIPO";
}

export interface PowerCardPick {
  kind: PowerCardKind;
  targetPlayerId: string;
  players: { id: string; name: string; isCaptain: boolean }[];
  teamName: string;
  emblemUrl: string | null;
}

/** Una fila de unidades de selección: glifo + nombre (la víctima prende). */
function PickRow({ pick, compact }: { pick: PowerCardPick; compact?: boolean }) {
  return (
    <div className={`pk-side${compact ? " pk-side--compact" : ""}`}>
      <div className="pk-side-team">
        {pick.emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.emblemUrl} alt="" />
        ) : null}
        <span>{pick.teamName}</span>
      </div>
      <div className="pk-roster">
        {pick.players.map((p, i) => {
          const hit = p.id === pick.targetPlayerId;
          return (
            <div
              key={p.id}
              className={`pk-unit${hit ? " pk-unit--hit" : ""}`}
              style={{ ["--pk-i" as string]: i }}
            >
              <i className="pk-glyph" aria-hidden>
                <span>{p.isCaptain ? "★" : p.name.trim().charAt(0).toUpperCase()}</span>
              </i>
              <b className="pk-name">{p.name}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PowerCardStage({
  kind,
  playerId,
  players,
  teamName,
  emblemUrl,
  duel = null,
  takeover = false,
}: {
  kind: PowerCardKind;
  /** ID del jugador objetivo (el marcado por la carta). */
  playerId: string;
  /** Roster del equipo afectado: la carta marcó a UNO de estos. */
  players: { id: string; name: string; isCaptain: boolean }[];
  /** Equipo afectado. */
  teamName: string;
  emblemUrl: string | null;
  /** Modo duelo: la carta mutua del equipo contrario (su víctima + roster). */
  duel?: PowerCardPick | null;
  /** true en el overlay real: toma la pantalla completa. */
  takeover?: boolean;
}) {
  const meta = powerCardMeta(kind);
  const isDuel = !!duel;
  const stage = (
    <div className={`pk-moment${isDuel ? " pk-moment--duel" : ""}`} data-kind={kind}>
      <div className="pk-rays" aria-hidden />
      <div className="pk-halo" aria-hidden />
      <div className="pk-card" aria-hidden>
        <div className="pk-card-3d">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pk-art" src={meta.img} alt="" />
        </div>
      </div>
      <div className="pk-title">
        {meta.name}
        {isDuel && duel && duel.kind !== kind ? ` + ${powerCardMeta(duel.kind).name}` : null}
      </div>
      <div className="pk-sub">{subtitleFor(isDuel, duel?.kind ?? null, kind)}</div>
      {isDuel && duel ? (
        <div className="pk-duel">
          <PickRow pick={{ kind, targetPlayerId: playerId, players, teamName, emblemUrl }} compact />
          <div className="pk-vs" aria-hidden>
            <i />
            <b>VS</b>
            <i />
          </div>
          <PickRow pick={duel} compact />
        </div>
      ) : (
        <PickRow pick={{ kind, targetPlayerId: playerId, players, teamName, emblemUrl }} />
      )}
    </div>
  );
  return takeover ? <div className="pk-takeover">{stage}</div> : stage;
}
