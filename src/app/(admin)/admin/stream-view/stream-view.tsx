"use client";

/**
 * StreamView — MONITOR del streamer (admin).
 *
 * Es un monitor de programa, no un dashboard: la escena ocupa TODA la
 * pantalla (16:9 máximo posible) y TODOS los controles viven en un dock
 * fino abajo. Lo que se ve arriba es exactamente lo que captura OBS.
 *
 * 5 escenas (client-side, 0 writes a la DB):
 *   1. SORTEO COMPLETO — la ruleta real con el preset real de la edición.
 *   2. RE-GIRAR FASE — la ruleta arrancando directo en la fase elegida.
 *   3. MEMOTEST DE CIVS — el sorteo de civs por equipo.
 *   4. CARTAS ÉPICAS — la secuencia cinematográfica de cada comodín.
 *   5. PANTALLA DEL STREAM — la escena del día de partido, paso a paso.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { ConfigProvider } from "@/lib/ruleta/config";
import type { PresetConfig } from "@/lib/ruleta/draw-engine";
import { simulateDraw, civsNeededFor, toForced, type ForcedChoices } from "@/lib/ruleta/simulate";
import Memotest, { type MemotestCard } from "@/components/memotest/memotest";
import ComodinEpic from "@/components/comodines/comodin-epic";
import VertigoSelect from "@/components/admin/vertigo-select";
import StreamScreenPreview, { TOUR_STEPS, type TourStepKey } from "./stream-screen-preview";
import { StreamBackdrop, EmberField, VsMedallionEpic, PHASE_BG } from "@/components/stream/stream-cinema";
import { deriveTeamPalette } from "@/components/team/team-banner-bg";
import { CIV_NAMES } from "@/lib/constants/civs";
import {
  Dices, Repeat, LayoutGrid, Sparkles, Tv, Play, ArrowLeftRight,
  ChevronLeft, ChevronRight, FastForward,
} from "lucide-react";

const Roulette = dynamic(() => import("@/components/ruleta/roulette").then((m) => m.Roulette), {
  ssr: false,
  loading: () => <ViewportMessage>Cargando la ruleta…</ViewportMessage>,
});

export interface StreamTeamLite {
  id: string;
  name: string;
  emblemUrl: string | null;
  seed: number | null;
}

type SceneKey = "sorteo" | "regirar" | "memotest" | "comodines" | "stream";

const SCENES: { key: SceneKey; label: string; icon: typeof Dices }[] = [
  { key: "sorteo", label: "Sorteo", icon: Dices },
  { key: "regirar", label: "Re-girar", icon: Repeat },
  { key: "memotest", label: "Civs", icon: LayoutGrid },
  { key: "comodines", label: "Comodines", icon: Sparkles },
  { key: "stream", label: "Stream", icon: Tv },
];

const REROLL_PHASES = [
  { value: "spinning-map-mode", label: "MAPA" },
  { value: "spinning-player-mode-direct", label: "FORMATO" },
  { value: "spinning-game-mode", label: "MODO" },
] as const;

const COMODIN_TYPES = [
  { value: "reroll", label: "RE-GIRAR" },
  { value: "anular", label: "ANULAR" },
  { value: "elegir_rival", label: "ELEGIR RIVAL" },
  { value: "invocar_pro", label: "INVOCAR PRO" },
] as const;

/** Opciones activas (weight>0) de una lista del preset. */
function activeOptions(list: any[] | undefined): any[] {
  return (list ?? []).filter((o) => (o.weight ?? 1) > 0);
}

function civLabel(id: string): string {
  return CIV_NAMES[id] ?? id;
}
function civImg(id: string): string {
  return `/civs/${id}.webp`;
}

function ViewportMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="sv-viewport-msg">
      <div className="sv-viewport-msg-inner">{children}</div>
    </div>
  );
}

export default function StreamView({
  preset,
  presetMeta,
  teams,
  editionName,
}: {
  preset: PresetConfig & Record<string, any>;
  presetMeta: { version: number; isFrozen: boolean } | null;
  teams: StreamTeamLite[];
  editionName: string;
}) {
  const [scene, setScene] = useState<SceneKey>("sorteo");

  // ── Equipos en escena (A vs B) ──
  const [teamAId, setTeamAId] = useState<string>(teams[0]?.id ?? "");
  const [teamBId, setTeamBId] = useState<string>(teams[1]?.id ?? "");
  const teamA = teams.find((t) => t.id === teamAId) ?? null;
  const teamB = teams.find((t) => t.id === (teamBId || teams[1]?.id || "")) ?? null;

  // ── Escena 1: sorteo completo ──
  const [drawRunId, setDrawRunId] = useState(0);
  const [forced, setForced] = useState<ForcedChoices>({});
  const [drawResult, setDrawResult] = useState<ReturnType<typeof simulateDraw> | null>(null);

  // ── Escena 2: re-girar ──
  const [rerollPhase, setRerollPhase] = useState<string>("spinning-map-mode");
  const [rerollRunId, setRerollRunId] = useState(0);
  const [rerollForcedMap, setRerollForcedMap] = useState<string>("");
  const [rerollForced, setRerollForced] = useState<any>(null);

  // ── Escena 3: memotest ──
  const [memoSide, setMemoSide] = useState<"A" | "B">("A");
  const [memoTrigger, setMemoTrigger] = useState(false);
  const [memoRevealed, setMemoRevealed] = useState<string[]>([]);
  const [memoRunId, setMemoRunId] = useState(0);
  const [memoNeeded, setMemoNeeded] = useState(2);
  const [memoRevealedA, setMemoRevealedA] = useState<string[]>([]); // civs de A, persisten mientras sorteа B

  // ── Escena 4: cartas épicas ──
  const [comodinType, setComodinType] = useState<string>("reroll");
  const [comodinTeamSide, setComodinTeamSide] = useState<"A" | "B">("A");
  const [epicTarget, setEpicTarget] = useState<string>("");
  const [epicRunId, setEpicRunId] = useState(0);

  // ── Escena 5: paso del torneo que se muestra ──
  const [tourStep, setTourStep] = useState<TourStepKey>("espera");
  const [tourChangedAt, setTourChangedAt] = useState(() => Date.now());
  const [tourAuto, setTourAuto] = useState(false);
  const tourIdx = TOUR_STEPS.findIndex((s) => s.key === tourStep);

  const gotoTourStep = (key: TourStepKey) => {
    setTourStep(key);
    setTourChangedAt(Date.now());
  };
  const stepTour = (dir: 1 | -1) => {
    const next = Math.min(TOUR_STEPS.length - 1, Math.max(0, (tourIdx >= 0 ? tourIdx : 0) + dir));
    gotoTourStep(TOUR_STEPS[next].key);
  };

  // Auto-avance del tour (7 s por paso, se detiene al final)
  useEffect(() => {
    if (!tourAuto) return;
    const t = setTimeout(() => {
      const nextIdx = (tourIdx >= 0 ? tourIdx : 0) + 1;
      if (nextIdx >= TOUR_STEPS.length) {
        setTourAuto(false);
        return;
      }
      gotoTourStep(TOUR_STEPS[nextIdx].key);
    }, 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourAuto, tourStep]);

  const civPool = useMemo(() => Object.keys(CIV_NAMES).slice(0, 9), []); // 12 solo en la final
  const memoCards: MemotestCard[] = useMemo(
    () => civPool.map((id) => ({ id: `${memoSide}-${id}`, civId: id, civName: civLabel(id), civImageUrl: civImg(id) })),
    [civPool, memoSide]
  );

  const presetForRuleta = useMemo(() => {
    const cfg: Record<string, any> = { ...preset };
    cfg.firstRound = true;
    return cfg;
  }, [preset]);

  const teamOptions = useMemo(
    () => teams.map((t) => ({ value: t.id, label: t.name })),
    [teams]
  );

  const startDraw = () => {
    const result = simulateDraw(preset, { firstGame: true, forced });
    setDrawResult(result);
    setDrawRunId((n) => n + 1);
  };

  const startReroll = () => {
    const base = drawResult ?? simulateDraw(preset, { firstGame: true });
    let nextForced = toForced(base);
    if (rerollPhase === "spinning-map-mode" && rerollForcedMap) {
      nextForced = { ...nextForced, mapId: rerollForcedMap };
    }
    setDrawResult(base);
    setRerollForced(nextForced);
    setRerollRunId((n) => n + 1);
  };

  const comodinTeam = comodinTeamSide === "A" ? teamA : teamB;
  const forcedCount = [forced.gameModeId, forced.playerModeId, forced.mapId, forced.llaveId, forced.antimetaModeId].filter(Boolean).length;

  const swapTeams = () => {
    setTeamAId(teamB?.id ?? teamAId);
    setTeamBId(teamA?.id ?? teamBId);
  };

  return (
    <div className="sv-stage-layout">
      {/* ══ MONITOR: la escena ocupa TODO ══ */}
      <div className="sv-viewport" key={`${scene}-${drawRunId}-${rerollRunId}-${memoRunId}-${epicRunId}`}>
        {scene === "sorteo" && (
          drawRunId === 0 ? (
            <ViewportMessage>
              Tocá <strong>Girar</strong> abajo — la ruleta corre con el preset real, tal cual la ve el stream.
            </ViewportMessage>
          ) : (
            <div className="sv-scene-fill">
              <ConfigProvider>
                <Roulette
                  key={`draw-${drawRunId}`}
                  forced={toForced(drawResult!)}
                  autoStart
                  interactive={false}
                  configOverride={presetForRuleta}
                />
              </ConfigProvider>
            </div>
          )
        )}

        {scene === "regirar" && (
          rerollRunId === 0 ? (
            <ViewportMessage>
              Elegí la fase y tocá <strong>Re-girar</strong> — como el comodín en vivo.
            </ViewportMessage>
          ) : (
            <div className="sv-scene-fill">
              <div className="sv-reroll-banner">
                <Repeat style={{ width: 14, height: 14 }} />
                RE-GIRAR {rerollPhase === "spinning-map-mode" ? "MAPA" : rerollPhase === "spinning-player-mode-direct" ? "FORMATO" : "MODO"}
              </div>
              <ConfigProvider>
                <Roulette
                  key={`reroll-${rerollRunId}`}
                  forced={rerollForced}
                  startPhase={rerollPhase as any}
                  interactive={false}
                  showResetCta={false}
                  configOverride={{ ...presetForRuleta, firstRound: false }}
                />
              </ConfigProvider>
            </div>
          )
        )}

        {scene === "memotest" && (
          <MemoScene
            teamA={teamA}
            teamB={teamB}
            memoSide={memoSide}
            memoRevealed={memoRevealed}
            memoNeeded={memoNeeded}
            memoCards={memoCards}
            memoRunId={memoRunId}
            memoTrigger={memoTrigger}
            onCivDrawn={(civ) => setMemoRevealed((prev) => [...prev, civ.civId])}
            memoRevealedA={memoRevealedA}
            onMemoChain={(revealedA) => {
              // A terminó su tanda → B roba el turno, la parrilla se resetea con el mismo trigger.
              setMemoRevealedA(revealedA);
              setMemoSide("B");
              setMemoRevealed([]);
            }}
          />
        )}

        {scene === "comodines" && (
          epicRunId === 0 ? (
            <ViewportMessage>
              Elegí el comodín y tocá <strong>Reproducir</strong>.
            </ViewportMessage>
          ) : (
            <div className="sv-epic-run" key={`epic-${epicRunId}`}>
              <ComodinEpic
                comodinType={comodinType}
                team={comodinTeam ? { id: comodinTeam.id, name: comodinTeam.name, emblemUrl: comodinTeam.emblemUrl } : null}
                targetName={epicTarget || null}
              />
            </div>
          )
        )}

        {scene === "stream" && (
          <StreamScreenPreview
            teamA={teamA}
            teamB={teamB}
            draw={drawResult ? {
              gameMode: drawResult.gameMode?.title ?? null,
              antimetaMode: drawResult.antimetaMode?.title ?? null,
              playerMode: drawResult.playerMode?.title ?? null,
              map: drawResult.map?.title ?? null,
              llave: drawResult.llave?.title ?? null,
              civsNeeded: civsNeededFor(drawResult.playerMode),
            } : null}
            memoRevealedA={memoRevealed}
            tourStep={tourStep}
            tourChangedAt={tourChangedAt}
          />
        )}
      </div>

      {/* ══ DOCK: una sola franja fina abajo, todo el control ══ */}
      <div className="sv-dock">
        {/* Escenas */}
        <div className="sv-dock-scenes">
          {SCENES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScene(s.key)}
              className={`sv-scene-btn ${scene === s.key ? "active" : ""}`}
              aria-pressed={scene === s.key}
              title={s.label}
            >
              <s.icon style={{ width: 14, height: 14 }} />
            </button>
          ))}
        </div>

        {/* Controles de la escena activa — solo lo que la escena necesita */}
        {scene === "sorteo" && (
          <>
            <VertigoSelect
              compact
              options={[
                { value: "", label: "🎲 Azar" },
                ...activeOptions(preset.gameModes).map((o) => ({ value: o.id, label: o.title })),
              ]}
              defaultValue={forced.gameModeId ?? ""}
              onValueChange={(v) => setForced((f) => ({ ...f, gameModeId: v || null }))}
            />
            {/antimeta/i.test(preset.gameModes.find((g) => g.id === forced.gameModeId)?.title ?? (forced.gameModeId ?? "")) && (
              <VertigoSelect
                compact
                options={[
                  { value: "", label: "🎲 Azar" },
                  ...activeOptions(preset.antimetaModes).map((o) => ({ value: o.id, label: o.title })),
                ]}
                defaultValue={forced.antimetaModeId ?? ""}
                onValueChange={(v) => setForced((f) => ({ ...f, antimetaModeId: v || null }))}
              />
            )}
            <VertigoSelect
              compact
              options={[
                { value: "", label: "🎲 Azar" },
                ...activeOptions(preset.playerModes).map((o) => ({ value: o.id, label: o.title })),
              ]}
              defaultValue={forced.playerModeId ?? ""}
              onValueChange={(v) => setForced((f) => ({ ...f, playerModeId: v || null }))}
            />
            <VertigoSelect
              compact
              options={[
                { value: "", label: "🎲 Azar" },
                ...activeOptions(preset.mapModes).map((o) => ({ value: o.id, label: o.title })),
              ]}
              defaultValue={forced.mapId ?? ""}
              onValueChange={(v) => setForced((f) => ({ ...f, mapId: v || null }))}
            />
            <button type="button" className="sv-dock-btn primary" onClick={startDraw}>
              <Play style={{ width: 13, height: 13 }} />
              Girar
            </button>
          </>
        )}

        {scene === "regirar" && (
          <>
            <VertigoSelect
              compact
              options={REROLL_PHASES.map((p) => ({ value: p.value, label: p.label }))}
              defaultValue={rerollPhase}
              onValueChange={setRerollPhase}
            />
            {rerollPhase === "spinning-map-mode" && (
              <VertigoSelect
                compact
                options={[
                  { value: "", label: "🎲 Azar" },
                  ...activeOptions(preset.mapModes).map((o) => ({ value: o.id, label: o.title })),
                ]}
                defaultValue={rerollForcedMap}
                onValueChange={setRerollForcedMap}
              />
            )}
            <button type="button" className="sv-dock-btn primary" onClick={startReroll}>
              <Repeat style={{ width: 13, height: 13 }} />
              Re-girar
            </button>
          </>
        )}

        {scene === "memotest" && (
          <>
            <VertigoSelect
              compact
              options={[
                { value: "A", label: teamA?.name ?? "Equipo A" },
                { value: "B", label: teamB?.name ?? "Equipo B" },
              ]}
              defaultValue={memoSide}
              onValueChange={(v) => {
                if (memoSide === "A" && memoRevealed.length > 0) setMemoRevealedA(memoRevealed);
                setMemoSide(v as "A" | "B");
                setMemoRevealed([]);
              }}
            />
            <VertigoSelect
              compact
              options={[1, 2, 3].map((n) => ({ value: String(n), label: `${n} civ${n > 1 ? "s" : ""}` }))}
              defaultValue={String(memoNeeded)}
              onValueChange={(v) => setMemoNeeded(Number(v))}
            />
            <button
              type="button"
              className="sv-dock-btn primary"
              onClick={() => { setMemoRunId((n) => n + 1); setMemoRevealed([]); setMemoRevealedA([]); setMemoSide("A"); setMemoTrigger(false); setTimeout(() => setMemoTrigger(true), 80); }}
            >
              <Play style={{ width: 13, height: 13 }} />
              Robar
            </button>
          </>
        )}

        {scene === "comodines" && (
          <>
            <VertigoSelect
              compact
              options={COMODIN_TYPES.map((c) => ({ value: c.value, label: c.label }))}
              defaultValue={comodinType}
              onValueChange={setComodinType}
            />
            <VertigoSelect
              compact
              options={[
                { value: "A", label: teamA?.name ?? "Equipo A" },
                { value: "B", label: teamB?.name ?? "Equipo B" },
              ]}
              defaultValue={comodinTeamSide}
              onValueChange={(v) => setComodinTeamSide(v as "A" | "B")}
            />
            <input
              className="sv-dock-input"
              type="text"
              value={epicTarget}
              onChange={(e) => setEpicTarget(e.target.value)}
              maxLength={40}
            />
            <button type="button" className="sv-dock-btn primary" onClick={() => setEpicRunId((n) => n + 1)}>
              <Sparkles style={{ width: 13, height: 13 }} />
              Reproducir
            </button>
          </>
        )}

        {scene === "stream" && (
          <>
            <VertigoSelect
              compact
              options={TOUR_STEPS.map((s) => ({ value: s.key, label: s.label }))}
              defaultValue={tourStep}
              onValueChange={(v) => gotoTourStep(v as TourStepKey)}
            />
            <button type="button" className="sv-dock-btn" onClick={() => stepTour(-1)} disabled={tourIdx <= 0} aria-label="Paso anterior">
              <ChevronLeft style={{ width: 14, height: 14 }} />
            </button>
            <span className="sv-dock-pos">{tourIdx + 1}/{TOUR_STEPS.length}</span>
            <button type="button" className="sv-dock-btn" onClick={() => stepTour(1)} disabled={tourIdx >= TOUR_STEPS.length - 1} aria-label="Paso siguiente">
              <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
            <button
              type="button"
              className={`sv-dock-btn ${tourAuto ? "on" : ""}`}
              onClick={() => { if (tourIdx >= TOUR_STEPS.length - 1) gotoTourStep(TOUR_STEPS[0].key); setTourAuto((v) => !v); }}
            >
              <FastForward style={{ width: 13, height: 13 }} />
              Auto
            </button>
            <button type="button" className="sv-dock-btn" onClick={() => { setScene("sorteo"); startDraw(); }} title="Sortear para llenar los chips">
              <Dices style={{ width: 13, height: 13 }} />
              Sortear
            </button>
          </>
        )}

        {/* Elenco — siempre visible, a la derecha del dock */}
        <div className="sv-dock-cast">
          <VertigoSelect
            compact
            options={teamOptions}
            defaultValue={teamAId}
            onValueChange={setTeamAId}
          />
          <button type="button" className="sv-dock-btn" onClick={swapTeams} title="Invertir A ⇄ B">
            <ArrowLeftRight style={{ width: 12, height: 12 }} />
          </button>
          <VertigoSelect
            compact
            options={teamOptions}
            defaultValue={teamBId}
            onValueChange={setTeamBId}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Escena 3 — MEMOTEST DE CIVS, en clave cinematográfica:
 * fondo de fase (memotest.mp4) con grado de cine + piso + brasas,
 * escudos en pedestal a los costados y la grilla de reliquias al centro.
 */
function MemoScene({
  teamA,
  teamB,
  memoSide,
  memoRevealed,
  memoNeeded,
  memoCards,
  memoRunId,
  memoTrigger,
  memoRevealedA,
  onMemoChain,
  onCivDrawn,
  layout,
}: {
  teamA: StreamTeamLite | null;
  teamB: StreamTeamLite | null;
  memoSide: "A" | "B";
  memoRevealed: string[];
  memoNeeded: number;
  memoCards: MemotestCard[];
  memoRunId: number;
  memoTrigger: boolean;
  memoRevealedA: string[];
  onMemoChain: (revealedA: string[]) => void;
  onCivDrawn: (civ: MemotestCard) => void;
  /** "side" = paneles verticales a los costados (nuevo) · "band" = barra superior (legacy) */
  layout?: "side" | "band";
}) {
  const [colorA] = deriveTeamPalette(teamA?.id ?? "a");
  const [colorB] = deriveTeamPalette(teamB?.id ?? "b");
  const memoLayout = layout ?? "side";

  return (
    <div style={{ position: "absolute", inset: 0, background: "#050505", overflow: "hidden" }}>
      <StreamBackdrop bg={PHASE_BG.civs} colorA={colorA} colorB={colorB} />
      <EmberField />
      {memoLayout === "side" ? (
        <div className="sv-memo-wrap is-side">
          {/* Equipo A: pilar vertical a la izquierda de la parrilla */}
          <MemoSidePanel team={teamA} civs={memoSide === "A" ? memoRevealed : memoRevealedA} active={memoSide === "A"} needed={memoNeeded} side="A" tint={colorA} />
          <div className="sv-memo-center">
            <div className="sv-memo-scroller">
              <Memotest
            key={`memo-${memoRunId}-${memoSide}`}
            cards={memoCards}
            civsToDraw={memoNeeded}
            teamSide={memoSide}
            alreadyDrawn={memoRevealed}
            trigger={memoTrigger}
            onCivDrawn={onCivDrawn}
            columns={3}
            showStrip={false}
            onComplete={
              memoSide === "B"
                ? undefined
                : (ids) => {
                    // A terminó su tanda → B roba el turno con el mismo run; la parrilla se resetea.
                    onMemoChain(ids);
                  }
            }
              />
            </div>
          </div>
          {/* Equipo B: pilar vertical a la derecha de la parrilla */}
          <MemoSidePanel team={teamB} civs={memoSide === "B" ? memoRevealed : []} active={memoSide === "B"} needed={memoNeeded} side="B" tint={colorB} />
        </div>
      ) : (
        <div className="sv-memo-wrap">
          {/* Legacy: banda superior con A — VS — B (backup del diseño anterior) */}
          <div className="sv-memo-band">
            <MemoBandSide team={teamA} civs={memoSide === "A" ? memoRevealed : memoRevealedA} active={memoSide === "A"} needed={memoNeeded} side="A" />
            <div className="sv-memo-vs"><VsMedallionEpic /></div>
            <MemoBandSide team={teamB} civs={memoSide === "B" ? memoRevealed : []} active={memoSide === "B"} needed={memoNeeded} side="B" />
          </div>
          <div className="sv-memo-scroller">
            <Memotest
              key={`memo-${memoRunId}-${memoSide}`}
              cards={memoCards}
              civsToDraw={memoNeeded}
              teamSide={memoSide}
              alreadyDrawn={memoRevealed}
              trigger={memoTrigger}
              onCivDrawn={onCivDrawn}
              columns={3}
              showStrip={false}
              onComplete={
                memoSide === "B"
                  ? undefined
                  : (ids) => {
                      onMemoChain(ids);
                    }
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Lado de la banda: escudo + nombre, y los slots de civs FIJOS desde el inicio —
 *  cada medalla cae en su lugar al sortearse, sin mover nada de la banda. */
function MemoBandSide({
  team, civs, active, needed, side,
}: {
  team: StreamTeamLite | null;
  civs: string[];
  active: boolean;
  needed: number;
  side: "A" | "B";
}) {
  return (
    <div className={`sv-band-side ${active ? "on" : ""}`} data-side={side}>
      <div className="sv-band-team">
        <div className="sv-mp-crest">
          {team?.emblemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.emblemUrl} alt="" />
          ) : (
            <span className="sv-mp-fallback">{(team?.name ?? "?").charAt(0)}</span>
          )}
        </div>
        <div className="sv-band-id">
          <div className="sv-mp-name">{team?.name ?? `Equipo ${side}`}</div>
          <div className={`sv-mp-state ${active ? "live" : ""}`}>{active ? "◆ SORTEANDO" : "EN ESPERA"}</div>
        </div>
      </div>
      <div className="sv-mp-civs">
        {Array.from({ length: needed }).map((_, i) => {
          const civId = civs[i];
          return civId ? (
            <span key={civId} className="sv-civ-medal">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={civImg(civId)} alt="" draggable={false} />
              <span className="sv-civ-medal-name">{civLabel(civId)}</span>
              {i === 0 && <i className="sv-civ-medal-star" aria-hidden />}
            </span>
          ) : (
            <span key={`slot-${side}-${i}`} className="sv-civ-slot" aria-hidden />
          );
        })}
      </div>
    </div>
  );
}

/** Pilar vertical de equipo a un costado de la parrilla: escudo grande arriba,
 *  nombre en Cinzel, estado, y los slots de civs (fijos desde el inicio) debajo.
 *  Misma disciplina anti-movimiento que la banda: huella fija por slot. */
function MemoSidePanel({
  team, civs, active, needed, side, tint,
}: {
  team: StreamTeamLite | null;
  civs: string[];
  active: boolean;
  needed: number;
  side: "A" | "B";
  tint: string;
}) {
  return (
    <aside className={`sv-side-panel ${active ? "on" : ""}`} data-side={side} style={{ "--sp-tint": tint } as CSSProperties}>
      <div className="sv-sp-aura" aria-hidden />
      <div className="sv-sp-crest">
        {team?.emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.emblemUrl} alt="" draggable={false} />
        ) : (
          <span className="sv-mp-fallback">{(team?.name ?? "?").charAt(0)}</span>
        )}
      </div>
      <div className="sv-sp-ornament" aria-hidden>
        <i /><b>✦</b><i />
      </div>
      <div className="sv-sp-name">{team?.name ?? `Equipo ${side}`}</div>
      <div className={`sv-sp-state ${active ? "live" : ""}`}>{active ? "◆ SORTEANDO" : "EN ESPERA"}</div>
      <div className="sv-sp-divider" aria-hidden><i /><i /><i /></div>
      <div className="sv-sp-civs">
        {Array.from({ length: needed }).map((_, i) => {
          const civId = civs[i];
          return civId ? (
            <div key={civId} className="sv-sp-medal">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={civImg(civId)} alt="" draggable={false} />
              <span className="sv-sp-medal-name">{civLabel(civId)}</span>
              {i === 0 && <i className="sv-civ-medal-star" aria-hidden />}
            </div>
          ) : (
            <div key={`slot-${side}-${i}`} className="sv-sp-slot" aria-hidden>
              <i className="sv-sp-slot-gem" />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
