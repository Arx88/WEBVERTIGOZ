"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Clock, Zap } from "lucide-react";

interface ComodinWindowProps {
  matchId: string;
  teamA: { id: string; name: string; emblemUrl?: string };
  teamB: { id: string; name: string; emblemUrl?: string };
  comodinA: { reroll: number; anular: number; elegir: number; invocar: number };
  comodinB: { reroll: number; anular: number; elegir: number; invocar: number };
  usages: { type: string; teamId: string; detail?: string }[];
  sorteo: {
    gameMode: string;
    antimeta?: string;
    playerMode: string;
    map: string;
    llaveFormat: string;
    civsA: { player: string; civ: string }[];
    civsB: { player: string; civ: string }[];
  };
  isAdmin: boolean;
  onStartMatch?: () => void;
}

const COMODIN_IMAGES: Record<string, string> = {
  reroll: "/comodin-regirar.png",
  anular: "/comodin-anular.png",
  elegir: "/comodin-elegir.png",
  invocar: "/comodin-invocar.png",
};

const COMODIN_LABELS: Record<string, string> = {
  reroll: "RE-GIRAR",
  anular: "ANULAR JUGADOR",
  elegir: "ELEGIR RIVAL",
  invocar: "INVOCAR PRO",
};

const COMODIN_COLORS: Record<string, string> = {
  reroll: "#4A6FA5",
  anular: "#7A5A8A",
  elegir: "#5B8C5A",
  invocar: "#C44536",
};

const WINDOW_SECONDS = 300; // 5 minutos

export default function ComodinWindow({
  matchId,
  teamA,
  teamB,
  comodinA,
  comodinB,
  usages,
  sorteo,
  isAdmin,
  onStartMatch,
}: ComodinWindowProps) {
  const [secondsLeft, setSecondsLeft] = useState(WINDOW_SECONDS);
  const [expired, setExpired] = useState(false);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setExpired(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const pct = (secondsLeft / WINDOW_SECONDS) * 100;
  const isUrgent = secondsLeft <= 60;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      background: "rgba(7, 3, 16, 0.97)",
      backdropFilter: "blur(16px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 24px",
      overflowY: "auto",
    }}>
      {/* Header con timer */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "32px",
        animation: "fadeDown 0.5s cubic-bezier(.22,1,.36,1) both",
      }}>
        <div style={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "4px",
          textTransform: "uppercase",
          color: isUrgent ? "#fb7185" : "#fbbf24",
          marginBottom: "8px",
          animation: isUrgent ? "pulse 0.8s ease-in-out infinite" : undefined,
        }}>
          ⚡ VENTANA DE COMODINES
        </div>
        <div style={{
          fontFamily: "Cinzel, serif",
          fontSize: isUrgent ? "56px" : "48px",
          fontWeight: 700,
          color: isUrgent ? "#fb7185" : "#fbbf24",
          fontVariantNumeric: "tabular-nums",
          textShadow: isUrgent ? "0 0 30px rgba(251,113,133,0.5)" : "0 0 20px rgba(251,191,36,0.3)",
          transition: "all 0.3s",
          letterSpacing: "2px",
        }}>
          {timeStr}
        </div>
        {/* Barra de progreso */}
        <div style={{
          width: "300px",
          height: "4px",
          background: "rgba(255,255,255,0.08)",
          borderRadius: "2px",
          marginTop: "12px",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: isUrgent
              ? "linear-gradient(90deg, #fb7185, #ef4444)"
              : "linear-gradient(90deg, #fbbf24, #f59e0b)",
            borderRadius: "2px",
            transition: "width 1s linear",
          }} />
        </div>
      </div>

      {/* Resultado del sorteo (compacto) */}
      <div style={{
        display: "flex",
        gap: "12px",
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: "32px",
        maxWidth: "700px",
      }}>
        {[
          { label: "MODO", value: sorteo.gameMode },
          ...(sorteo.antimeta ? [{ label: "ANTIMETA", value: sorteo.antimeta }] : []),
          { label: "FORMATO", value: sorteo.playerMode },
          { label: "MAPA", value: sorteo.map },
          { label: "LLAVE", value: sorteo.llaveFormat },
        ].map((item, i) => (
          <div key={i} style={{
            padding: "8px 14px",
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: "8px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "9px", color: "#6b6378", letterSpacing: "1px", textTransform: "uppercase" }}>{item.label}</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#c4b5fd" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Civs asignadas */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
        maxWidth: "700px",
        width: "100%",
        marginBottom: "32px",
      }}>
        {/* Team A civs */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            {teamA.emblemUrl && <img src={teamA.emblemUrl} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />}
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#f2eef7" }}>{teamA.name}</span>
          </div>
          {sorteo.civsA.map((c, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "rgba(13,9,19,0.6)",
              border: "1px solid #1a1424",
              borderRadius: "8px",
              marginBottom: "6px",
            }}>
              <img src={`/civs/${c.civ}.webp`} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: 600 }}>{c.civ}</div>
                <div style={{ fontSize: "10px", color: "#6b6378" }}>→ {c.player}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Team B civs */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            {teamB.emblemUrl && <img src={teamB.emblemUrl} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />}
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#f2eef7" }}>{teamB.name}</span>
          </div>
          {sorteo.civsB.map((c, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "rgba(13,9,19,0.6)",
              border: "1px solid #1a1424",
              borderRadius: "8px",
              marginBottom: "6px",
            }}>
              <img src={`/civs/${c.civ}.webp`} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: 600 }}>{c.civ}</div>
                <div style={{ fontSize: "10px", color: "#6b6378" }}>→ {c.player}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comodines de cada equipo */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
        maxWidth: "700px",
        width: "100%",
        marginBottom: "32px",
      }}>
        <ComodinTeamPanel teamName={teamA.name} emblemUrl={teamA.emblemUrl} comodin={comodinA} usages={usages.filter(u => u.teamId === teamA.id)} />
        <ComodinTeamPanel teamName={teamB.name} emblemUrl={teamB.emblemUrl} comodin={comodinB} usages={usages.filter(u => u.teamId === teamB.id)} />
      </div>

      {/* Usos de comodines (eventos) */}
      {usages.length > 0 && (
        <div style={{ maxWidth: "700px", width: "100%", marginBottom: "32px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#fbbf24", marginBottom: "12px" }}>
            Comodines usados
          </div>
          {usages.map((u, i) => (
            <div key={i} style={{
              padding: "10px 14px",
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.2)",
              borderRadius: "8px",
              marginBottom: "6px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              animation: "fadeUp 0.4s cubic-bezier(.22,1,.36,1) both",
              animationDelay: `${i * 0.1}s`,
            }}>
              <img src={COMODIN_IMAGES[u.type]} alt="" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fbbf24" }}>
                  {COMODIN_LABELS[u.type]}
                </div>
                <div style={{ fontSize: "11px", color: "#9a92a6" }}>
                  {u.detail || `Usado por un equipo`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón comenzar partida (admin) */}
      {isAdmin && (expired || secondsLeft <= 0) && onStartMatch && (
        <button
          onClick={onStartMatch}
          style={{
            padding: "18px 40px",
            background: "linear-gradient(180deg, #22c55e, #16a34a)",
            color: "#fff",
            border: "none",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "2px",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(34,197,94,0.4)",
            animation: "fadeUp 0.5s cubic-bezier(.22,1,.36,1) both",
          }}
        >
          ▶ Comenzar Partida
        </button>
      )}

      {isAdmin && !expired && (
        <div style={{
          fontSize: "13px",
          color: "#6b6378",
          textAlign: "center",
        }}>
          Esperando que termine la ventana de comodines... ({timeStr} restante)
        </div>
      )}

      <style>{`
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: none; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

function ComodinTeamPanel({
  teamName,
  emblemUrl,
  comodin,
  usages,
}: {
  teamName: string;
  emblemUrl?: string;
  comodin: { reroll: number; anular: number; elegir: number; invocar: number };
  usages: { type: string; teamId: string; detail?: string }[];
}) {
  const items = [
    { key: "reroll", available: comodin.reroll, total: 2 },
    { key: "anular", available: comodin.anular, total: 1 },
    { key: "elegir", available: comodin.elegir, total: 1 },
    { key: "invocar", available: comodin.invocar, total: 1 },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        {emblemUrl && <img src={emblemUrl} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />}
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#f2eef7" }}>{teamName}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {items.map((item) => {
          const isAvailable = item.available > 0;
          const wasUsed = usages.some((u) => u.type === item.key);
          return (
            <div key={item.key} style={{
              position: "relative",
              padding: "10px",
              background: isAvailable ? `${COMODIN_COLORS[item.key]}15` : "rgba(13,9,19,0.4)",
              border: `1px solid ${isAvailable ? COMODIN_COLORS[item.key] + "55" : "#1a1424"}`,
              borderRadius: "10px",
              opacity: isAvailable ? 1 : 0.4,
              transition: "all 0.3s",
              overflow: "hidden",
            }}>
              <img
                src={COMODIN_IMAGES[item.key]}
                alt={COMODIN_LABELS[item.key]}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "60px",
                  objectFit: "contain",
                  marginBottom: "6px",
                  filter: isAvailable ? "none" : "grayscale(0.7)",
                }}
              />
              <div style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: isAvailable ? COMODIN_COLORS[item.key] : "#6b6378",
                textAlign: "center",
              }}>
                {COMODIN_LABELS[item.key]}
              </div>
              <div style={{
                fontSize: "14px",
                fontWeight: 700,
                color: isAvailable ? COMODIN_COLORS[item.key] : "#6b6378",
                textAlign: "center",
                fontFamily: "Inter, sans-serif",
              }}>
                {item.available}/{item.total}
              </div>
              {wasUsed && (
                <div style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  background: "#fbbf24",
                  color: "#000",
                  fontSize: "8px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "999px",
                }}>
                  USADO
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
