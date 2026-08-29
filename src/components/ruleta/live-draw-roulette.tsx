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

interface LiveDrawRouletteProps {
  matchId: string;
  /** Se llama cuando la animación termina y el resultado quedó visible */
  onDone?: () => void;
  /** Si true, el admin ve controles extra (futuro: re-girar fase) */
  isAdmin?: boolean;
}

type LiveState =
  | { kind: "loading" }
  | { kind: "waiting" }          // el sorteo aún no está revealed
  | { kind: "ready"; result: any; preset: any }
  | { kind: "error"; message: string };

export default function LiveDrawRoulette({ matchId, onDone, isAdmin }: LiveDrawRouletteProps) {
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

  // Realtime: cuando el draw cambia a revealed/published, refrescar
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`live-draw-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "roulette_draw" }, () => { void fetchLive(); })
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

  if (state.kind === "loading" || state.kind === "waiting") {
    return <DrawLoader text={state.kind === "loading" ? "Preparando el sorteo…" : "Esperando al server…"} />;
  }
  if (state.kind === "error") {
    return (
      <DrawLoader text={`Error: ${state.message}`} isError />
    );
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
