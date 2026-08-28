"use client";

import { useEffect, useState } from "react";
import { Radar, CheckCircle2, Radio, AlertTriangle, HelpCircle } from "lucide-react";

/**
 * Indicador pasivo del sync con AoE2 Companion para una partida in_progress.
 *
 * Muestra qué está viendo el watcher sin requerir ninguna acción del admin:
 *  - pending:  "hace X min en ¡Se juega! — todavía no detecto la partida"
 *  - live:     la partida está EN VIVO en AoE2 (se encontró por el nombre)
 *  - synced:   detectada, rec/análisis archivados y resultado cargado
 *  - config_mismatch / no_winner: encontrada pero inválida (motivo visible)
 *
 * El ticker es local (cada 30s); los datos reales llegan por Realtime →
 * router.refresh() del MatchLiveRefresher.
 */
export default function Aoe2SyncIndicator({
  syncStatus,
  flag,
  aoe2MatchId,
  startedAt,
}: {
  syncStatus: string;
  flag: string | null;
  aoe2MatchId: number | null;
  startedAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const elapsedMin = startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000)) : null;

  const iconStyle = { width: 13, height: 13, flexShrink: 0 };

  if (syncStatus === "synced") {
    return (
      <div className="inline-flex items-start gap-2 text-[11px]" style={{ color: "var(--vertigo-success)" }}>
        <CheckCircle2 style={{ ...iconStyle, marginTop: 1 }} />
        <span>
          Partida detectada en AoE2 Companion{aoe2MatchId ? ` (match ${aoe2MatchId})` : ""}: rec y análisis
          archivados, resultado cargado automáticamente.
        </span>
      </div>
    );
  }

  if (syncStatus === "live") {
    return (
      <div className="inline-flex items-start gap-2 text-[11px] font-semibold" style={{ color: "var(--vertigo-danger)" }}>
        <Radio style={{ ...iconStyle, marginTop: 1 }} />
        <span>
          EN VIVO en AoE2{aoe2MatchId ? ` (match ${aoe2MatchId})` : ""} — esperando que termine para cargar el
          resultado.
        </span>
      </div>
    );
  }

  if (syncStatus === "config_mismatch" || syncStatus === "no_winner") {
    return (
      <div className="inline-flex items-start gap-2 text-[11px]" style={{ color: "#fbbf24" }}>
        <AlertTriangle style={{ ...iconStyle, marginTop: 1 }} />
        <span>
          {flag ?? "Encontré una partida con este nombre pero no es válida para auto-reportar."}
          {" "}Podés vincular un match de Companion más abajo, o cargar el resultado manualmente.
        </span>
      </div>
    );
  }

  // pending
  return (
    <div className="inline-flex items-start gap-2 text-[11px] text-[var(--vertigo-muted)]">
      <Radar style={{ ...iconStyle, marginTop: 1, color: "var(--vertigo-faint)" }} />
      <span>
        {elapsedMin != null && elapsedMin >= 3 ? (
          <>
            Hace <b>{elapsedMin} min</b> que está en ¡Se juega! y todavía no detecto una partida con el nombre de
            sala. <HelpCircle style={{ width: 11, height: 11, display: "inline" }} /> Verificá que la sala se haya
            creado con el nombre exacto.
          </>
        ) : (
          <>Buscando la partida en AoE2 Companion por el nombre de sala…</>
        )}
      </span>
    </div>
  );
}
