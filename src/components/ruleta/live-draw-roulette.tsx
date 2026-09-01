"use client";

/**
 * VÉRTIGO Cup — LiveDrawRoulette (overlay de sorteo en vivo)
 *
 * Self-contained: fetchea el resultado del sorteo (decidido por el server)
 * desde /api/draw/live, escucha cambios por Realtime, y reproduce la animación
 * sincronizada para TODOS los viewers al mismo tiempo.
 *
 * Filosofía "server decide / client anima":
 *  - El server (startDrawAction) decidió el resultado con crypto y lo persistió.
 *  - Este componente solo ANIMA ese resultado. Nunca sortea nada en el cliente.
 *  - El preset viene del server → todos los viewers ven las mismas opciones.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ConfigProvider } from "@/lib/ruleta/config";

const Roulette = dynamic(() => import("@/components/ruleta/roulette").then((m) => m.Roulette), {
  ssr: false,
  loading: () => <DrawLoader text="Cargando la ruleta…" />,
});

const POLL_INTERVAL_MS = 3000;
/** Segundos que el resultado queda en pantalla antes de ceder la escena. */
const HOLD_RESULT_S = 8;

interface LiveDrawRouletteProps {
  matchId: string;
  /** Se llama cuando la animación termina y el resultado quedó visible */
  onDone?: () => void;
  /** Si true, el admin ve controles extra (futuro: re-girar fase) */
  isAdmin?: boolean;
  /**
   * ANIMAR vs ESTÁTICO. La action persiste el draw YA revelado antes de
   * marcar el match como "drawing", así que el timing del fetch no sirve
   * para distinguir un sorteo en vivo de uno ya pasado: para cualquiera
   * que monte la ruleta después del click el resultado "ya existía".
   * La señal correcta es el contexto de montaje del overlay:
   *  - live=true: esta pantalla VIÓ el status pasar a drawing (cargó en
   *    open/scheduled y el Realtime lo trajo) → animar.
   *  - live=false: la pantalla cargó YA en drawing (re-entrada, reload,
   *    OBS prendido tarde) → el sorteo ya pasó, panel estático.
   */
  live?: boolean;
}

type LiveState =
  | { kind: "loading" }
  | { kind: "waiting" }          // el sorteo aún no está revealed
  | { kind: "ready"; result: any; preset: any }
  | { kind: "error"; message: string };

export default function LiveDrawRoulette({ matchId, onDone, isAdmin, live }: LiveDrawRouletteProps) {
  const [state, setState] = useState<LiveState>({ kind: "loading" });
  const [forced, setForced] = useState<any>(null);
  const fetchedOnce = useRef(false);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/draw/live?match_id=${encodeURIComponent(matchId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.found && data.result) {
        setState({ kind: "ready", result: data.result, preset: data.preset });
        setForced({
          gameModeId: data.result.gameMode?.id,
          antimetaModeId: data.result.antimetaMode?.id ?? undefined,
          playerModeId: data.result.playerMode?.id,
          mapId: data.result.map?.id,
          llaveId: data.result.llave?.id ?? undefined,
        });
        return true;
      }
      setState({ kind: "waiting" });
      return false;
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Error" });
      return false;
    }
  }, [matchId]);

  // Fetch inicial una vez
  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    fetchLive();
  }, [fetchLive]);

  // Realtime: cuando el match cambia a drawing (o la partida activa se
  // actualiza), refrescar el resultado. roulette_draw NO está en la
  // publicación Realtime (verificado empíricamente): suscribirse a esa tabla
  // era un canal muerto — el draw llega vía match/match_game + polling.
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`live-draw-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match", filter: `id=eq.${matchId}` }, () => { void fetchLive(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_game", filter: `match_id=eq.${matchId}` }, () => { void fetchLive(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId, fetchLive]);

  // Polling de respaldo mientras espera que el server revele
  useEffect(() => {
    if (state.kind === "ready") return;
    const t = setInterval(() => { void fetchLive(); }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [state.kind, fetchLive]);

  const handleResult = useCallback(() => {
    onDone?.();
  }, [onDone]);

  // ¿Esta pantalla vio el sorteo EN VIVO (cargó antes de que el status
  // pasara a drawing)? Solo entonces corresponde animar la ruleta. Si
  // cargó ya en drawing (re-entrada/reload/OBS tarde) el sorteo YA PASÓ:
  // panel estático que se auto-cierra tras HOLD_RESULT_S. Nunca re-animamos
  // un sorteo viejo.
  const showStatic = state.kind === "ready" && !live;
  useEffect(() => {
    if (state.kind !== "ready" || live) return;
    const t = setTimeout(() => onDone?.(), HOLD_RESULT_S * 1000);
    return () => clearTimeout(t);
  }, [live, state.kind, onDone]);

  if (state.kind === "loading" || state.kind === "waiting") {
    return <DrawLoader text={state.kind === "loading" ? "Preparando el sorteo…" : "Esperando al server…"} />;
  }
  if (state.kind === "error") {
    return (
      <DrawLoader text={`Error: ${state.message}`} isError />
    );
  }

  if (showStatic) {
    return <RevealedDrawPanel result={state.result} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#050505" }}>
      {/* Roulette exige ConfigProvider (useConfig); el preset del server
          llega por configOverride y pisa la config local. */}
      <ConfigProvider>
        <Roulette
          forced={forced}
          configOverride={state.kind === "ready" ? state.preset : undefined}
          // Reproducción automática: todos los viewers ven la MISMA animación
          // que cae en el resultado del server. Nadie (salvo un futuro admin con
          // isAdmin=true) dispara el giro a mano; `interactive` está desactivado
          // para que nadie pueda girar la ruleta.
          autoStart
          interactive={isAdmin === true}
          onResult={handleResult}
          // En vivo el resultado lo decide el server: el botón "NUEVO SORTEO"
          // (re-girar a mano) solo existe para demo/tutorial.
          showResetCta={false}
        />
      </ConfigProvider>
    </div>
  );
}

function DrawLoader({ text, isError }: { text: string; isError?: boolean }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 90, background: "#050505",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22,
    }}>
      {!isError && (
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#c4b5fd",
          animation: "spin 0.9s linear infinite",
        }} />
      )}
      <div style={{
        fontFamily: "Cinzel, serif", letterSpacing: "0.32em", fontSize: 13, textTransform: "uppercase",
        color: isError ? "#fb7185" : "#c4b5fd",
      }}>
        {text}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/**
 * Panel estático del sorteo ya realizado (re-entradas al overlay): el
 * resultado en tarjetas legibles + "SORTEO FINALIZADO" — la ruleta no se
 * re-anima porque el sorteo ya pasó. Mismo lenguaje visual que la escena
 * de results de la ruleta (eyebrow dorado + tarjetas con imagen).
 */
function RevealedDrawPanel({ result }: { result: any }) {
  const steps = [
    { key: "mode", label: "MODO", title: result?.gameMode?.title, img: result?.gameMode?.img, color: "#c4b5fd" },
    { key: "antimeta", label: "ANTIMETA", title: result?.antimetaMode?.title, img: result?.antimetaMode?.img, color: "#fbbf24" },
    { key: "player", label: "FORMATO", title: result?.playerMode?.title, img: result?.playerMode?.img, color: "#a5b4fc" },
    { key: "llave", label: "LLAVE", title: result?.llave?.title, img: result?.llave?.img, color: "#e9d18a" },
    { key: "map", label: "MAPA", title: result?.map?.title, img: result?.map?.img, color: result?.map?.color ?? "#e9d18a" },
  ].filter((s) => !!s.title);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 90, background: "#050505",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3.5vh",
      padding: "4vh 4vw", textAlign: "center",
    }}>
      <div style={{
        fontFamily: "Cinzel, serif", letterSpacing: "0.4em", fontSize: "clamp(11px, 1.2vw, 18px)",
        textTransform: "uppercase", color: "#e9d18a", textShadow: "0 0 22px rgba(212,175,55,0.4)",
      }}>
        ◆ SORTEO FINALIZADO
      </div>
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "clamp(12px, 1.6vw, 28px)",
        maxWidth: "92vw",
      }}>
        {steps.map((s) => (
          <div key={s.key} style={{
            width: "clamp(150px, 17vw, 260px)", borderRadius: 14, overflow: "hidden",
            border: `1.5px solid ${s.color}55`, background: "rgba(13,9,19,0.85)",
            boxShadow: `0 12px 34px rgba(0,0,0,0.6), 0 0 22px ${s.color}22`,
          }}>
            {s.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.img} alt={s.title} style={{ width: "100%", height: "clamp(84px, 10vw, 150px)", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "clamp(84px, 10vw, 150px)", background: `${s.color}18`, display: "block" }} />
            )}
            <div style={{ padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "3px", color: "rgba(207,200,221,0.55)", marginBottom: 4, textTransform: "uppercase" }}>
                {s.label}
              </div>
              <div style={{
                fontFamily: "Cinzel, serif", fontSize: "clamp(13px, 1.4vw, 20px)", fontWeight: 700,
                color: "var(--vertigo-text, #efeaf7)", lineHeight: 1.15, overflowWrap: "anywhere",
              }}>
                {s.title}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{
        fontSize: "clamp(10px, 1vw, 15px)", letterSpacing: "3px", textTransform: "uppercase",
        color: "rgba(207,200,221,0.55)",
      }}>
        Esperando la fase de lineup…
      </div>
    </div>
  );
}
