"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ConfigProvider } from "@/lib/ruleta/config";
import { civName } from "@/lib/constants/civs";
import Link from "next/link";

const Roulette = dynamic(
  () => import("@/components/ruleta/roulette").then((m) => m.Roulette),
  { ssr: false }
) as React.ComponentType<{ onResult?: (resolved: any[], resolvedMap: any) => void }>;

type DemoPhase = "intro" | "roulette" | "results" | "comodines" | "done";

const TEAM_A = { name: "Caballeros del Caos", emblem: "/reinos/reino-1.webp", elo: 2840 };
const TEAM_B = { name: "Legión Oscura", emblem: "/reinos/reino-5.webp", elo: 2910 };

export default function DemoClient() {
  const [phase, setPhase] = useState<DemoPhase>("intro");
  const [results, setResults] = useState<any[]>([]);
  const [mapResult, setMapResult] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState(300);

  const handleRouletteResult = useCallback((resolved: any[], resolvedMap: any) => {
    setResults(resolved);
    setMapResult(resolvedMap);
    setPhase("results");
  }, []);

  const startComodinWindow = () => {
    setPhase("comodines");
    setSecondsLeft(300);
    // Countdown
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase("done");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = (secondsLeft % 60).toString().padStart(2, "0");
  const isUrgent = secondsLeft <= 60;

  // Extraer resultados legibles de la ruleta
  const getResult = (label: string) => {
    const step = results.find((r) => r.label === label);
    return step?.mode?.title ?? "—";
  };

  return (
    <ConfigProvider>
      <div style={{ minHeight: "100vh", background: "#070310", color: "#f2eef7", fontFamily: "Inter, sans-serif" }}>

        {/* INTRO */}
        {phase === "intro" && (
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", textAlign: "center" }}>
            <img src="/landing/logo.png" alt="VÉRTIGO" style={{ width: "100px", marginBottom: "24px" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#7c3aed", textTransform: "uppercase", marginBottom: "12px" }}>DEMO FIEL</span>
            <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "36px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>Sorteo Real</h1>
            <p style={{ fontSize: "14px", color: "#9a92a6", maxWidth: "460px", lineHeight: 1.6, marginBottom: "28px" }}>
              La ruleta real girando con tus imágenes, tu CSS, tu animación.
              Después del sorteo: resultados, ventana de comodines con timer y las cartas reales.
            </p>

            {/* Match preview */}
            <div style={{ display: "flex", alignItems: "center", gap: "32px", marginBottom: "32px" }}>
              <div style={{ textAlign: "center" }}>
                <img src={TEAM_A.emblem} alt="" style={{ width: "56px", height: "56px", objectFit: "contain", marginBottom: "6px" }} />
                <div style={{ fontSize: "13px", fontWeight: 600 }}>{TEAM_A.name}</div>
                <div style={{ fontSize: "11px", color: "#6b6378" }}>ELO {TEAM_A.elo}</div>
              </div>
              <div style={{ fontFamily: "Cinzel, serif", fontSize: "28px", fontWeight: 700, color: "#7c3aed" }}>VS</div>
              <div style={{ textAlign: "center" }}>
                <img src={TEAM_B.emblem} alt="" style={{ width: "56px", height: "56px", objectFit: "contain", marginBottom: "6px" }} />
                <div style={{ fontSize: "13px", fontWeight: 600 }}>{TEAM_B.name}</div>
                <div style={{ fontSize: "11px", color: "#6b6378" }}>ELO {TEAM_B.elo}</div>
              </div>
            </div>

            <button
              onClick={() => setPhase("roulette")}
              style={{
                padding: "16px 36px",
                background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
                color: "#fff", border: "none", borderRadius: "10px",
                fontSize: "13px", fontWeight: 700, letterSpacing: "2px",
                textTransform: "uppercase", cursor: "pointer",
                boxShadow: "0 6px 26px rgba(109,40,217,.35)",
              }}
            >
              🎰 Iniciar Sorteo
            </button>
            <Link href="/" style={{ marginTop: "16px", fontSize: "12px", color: "#6b6378", textDecoration: "none" }}>← Volver</Link>
          </div>
        )}

        {/* ROULETTE — la ruleta real girando */}
        {phase === "roulette" && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
            {/* Match bar arriba */}
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
              padding: "10px 24px", background: "rgba(7,3,16,0.85)", backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <img src={TEAM_A.emblem} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{TEAM_A.name}</span>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "2px", color: "#fbbf24", textTransform: "uppercase", animation: "pulse 1.5s infinite" }}>
                🎰 SORTEANDO...
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{TEAM_B.name}</span>
                <img src={TEAM_B.emblem} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
              </div>
            </div>
            <Roulette onResult={handleRouletteResult} />
            <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          </div>
        )}

        {/* RESULTS — después de que la ruleta termina */}
        {phase === "results" && (
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#22c55e", textTransform: "uppercase", marginBottom: "8px" }}>SORTEO COMPLETADO</span>
            <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "28px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "24px" }}>Resultados</h1>

            {/* Result cards — extraídos de lo que la ruleta resolvió */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", justifyContent: "center", maxWidth: "800px", marginBottom: "32px" }}>
              {results.map((step, i) => (
                <div key={i} style={{
                  width: "160px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: `2px solid ${step.accent}`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${step.accent}44`,
                  animation: `fadeUp 0.4s cubic-bezier(.22,1,.36,1) both`,
                  animationDelay: `${i * 0.1}s`,
                }}>
                  <div style={{ position: "relative", height: "90px", overflow: "hidden" }}>
                    <img src={step.mode.img} alt={step.mode.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent 60%)" }} />
                  </div>
                  <div style={{ padding: "10px 12px", background: "rgba(13,9,19,0.9)" }}>
                    <div style={{ fontSize: "9px", color: step.accent, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>{step.label}</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{step.mode.title}</div>
                  </div>
                </div>
              ))}
              {mapResult && (
                <div style={{
                  width: "160px", borderRadius: "10px", overflow: "hidden",
                  border: `2px solid ${mapResult.map.color}`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${mapResult.map.color}44`,
                  animation: "fadeUp 0.4s cubic-bezier(.22,1,.36,1) both",
                  animationDelay: `${results.length * 0.1}s`,
                }}>
                  <div style={{ position: "relative", height: "90px", overflow: "hidden" }}>
                    <img src={mapResult.map.img} alt={mapResult.map.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent 60%)" }} />
                  </div>
                  <div style={{ padding: "10px 12px", background: "rgba(13,9,19,0.9)" }}>
                    <div style={{ fontSize: "9px", color: mapResult.map.color, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>MAPA</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{mapResult.map.title}</div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={startComodinWindow}
              style={{
                padding: "14px 32px", background: "linear-gradient(180deg, #fbbf24, #f59e0b)",
                color: "#000", border: "none", borderRadius: "10px",
                fontSize: "13px", fontWeight: 700, letterSpacing: "2px",
                textTransform: "uppercase", cursor: "pointer",
                boxShadow: "0 6px 26px rgba(251,191,36,0.35)",
              }}
            >
              ⚡ Abrir Ventana de Comodines
            </button>
            <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: none; } }`}</style>
          </div>
        )}

        {/* COMODINES — timer + cartas reales */}
        {phase === "comodines" && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(7,3,16,0.97)", backdropFilter: "blur(16px)",
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "32px 24px", overflowY: "auto",
          }}>
            {/* Timer */}
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase", color: isUrgent ? "#fb7185" : "#fbbf24", marginBottom: "8px", animation: isUrgent ? "pulse 0.8s infinite" : undefined }}>
              ⚡ VENTANA DE COMODINES
            </div>
            <div style={{
              fontFamily: "Cinzel, serif", fontSize: isUrgent ? "56px" : "48px", fontWeight: 700,
              color: isUrgent ? "#fb7185" : "#fbbf24", fontVariantNumeric: "tabular-nums",
              textShadow: isUrgent ? "0 0 30px rgba(251,113,133,0.5)" : "0 0 20px rgba(251,191,36,0.3)",
              letterSpacing: "2px",
            }}>
              {mins}:{secs}
            </div>
            <div style={{ width: "300px", height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", marginTop: "12px", overflow: "hidden" }}>
              <div style={{
                width: `${(secondsLeft / 300) * 100}%`, height: "100%",
                background: isUrgent ? "linear-gradient(90deg, #fb7185, #ef4444)" : "linear-gradient(90deg, #fbbf24, #f59e0b)",
                borderRadius: "2px", transition: "width 1s linear",
              }} />
            </div>

            {/* Resultado del sorteo compacto */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "24px", marginBottom: "32px" }}>
              {results.map((step, i) => (
                <div key={i} style={{
                  padding: "6px 12px", background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)", borderRadius: "8px",
                }}>
                  <div style={{ fontSize: "9px", color: "#6b6378", letterSpacing: "1px", textTransform: "uppercase" }}>{step.label}</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#c4b5fd" }}>{step.mode.title}</div>
                </div>
              ))}
              {mapResult && (
                <div style={{ padding: "6px 12px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "9px", color: "#6b6378", letterSpacing: "1px", textTransform: "uppercase" }}>MAPA</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#c4b5fd" }}>{mapResult.map.title}</div>
                </div>
              )}
            </div>

            {/* Comodines de cada equipo con las imágenes reales */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "600px", width: "100%" }}>
              {/* Team A */}
              <ComodinTeam teamName={TEAM_A.name} emblemUrl={TEAM_A.emblem} />
              {/* Team B */}
              <ComodinTeam teamName={TEAM_B.name} emblemUrl={TEAM_B.emblem} />
            </div>

            <div style={{ marginTop: "32px", fontSize: "13px", color: "#6b6378", textAlign: "center" }}>
              Esperando que termine el timer...
            </div>

            <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          </div>
        )}

        {/* DONE — comienza la partida */}
        {phase === "done" && (
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: "#22c55e", textTransform: "uppercase", marginBottom: "12px" }}>VENTANA CERRADA</span>
            <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "32px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>¡Comienza la partida!</h1>

            {/* Scoreboard final */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "32px", alignItems: "center", maxWidth: "600px", width: "100%", marginBottom: "32px" }}>
              <div style={{ textAlign: "center" }}>
                <img src={TEAM_A.emblem} alt="" style={{ width: "64px", height: "64px", objectFit: "contain", marginBottom: "8px" }} />
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "16px", fontWeight: 700 }}>{TEAM_A.name}</div>
              </div>
              <div style={{ fontFamily: "Cinzel, serif", fontSize: "32px", fontWeight: 700, color: "#9a92a6" }}>VS</div>
              <div style={{ textAlign: "center" }}>
                <img src={TEAM_B.emblem} alt="" style={{ width: "64px", height: "64px", objectFit: "contain", marginBottom: "8px" }} />
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "16px", fontWeight: 700 }}>{TEAM_B.name}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => { setPhase("intro"); setResults([]); setMapResult(null); setSecondsLeft(300); }} style={{
                padding: "14px 32px", background: "linear-gradient(180deg, #6d28d9, #5b21b6)",
                color: "#fff", border: "none", borderRadius: "10px",
                fontSize: "13px", fontWeight: 700, letterSpacing: "2px",
                textTransform: "uppercase", cursor: "pointer",
                boxShadow: "0 6px 26px rgba(109,40,217,.35)",
              }}>
                ↻ Nuevo Sorteo
              </button>
              <Link href="/" style={{
                padding: "14px 28px", background: "transparent",
                color: "#b7b0c2", border: "1px solid #322a3e", borderRadius: "10px",
                fontSize: "13px", fontWeight: 700, letterSpacing: "2px",
                textTransform: "uppercase", textDecoration: "none",
                display: "inline-flex", alignItems: "center",
              }}>
                Inicio
              </Link>
            </div>
          </div>
        )}
      </div>
    </ConfigProvider>
  );
}

function ComodinTeam({ teamName, emblemUrl }: { teamName: string; emblemUrl: string }) {
  const comodines = [
    { img: "/comodin-regirar.png", label: "RE-GIRAR", color: "#4A6FA5", available: 2, total: 2 },
    { img: "/comodin-anular.png", label: "ANULAR", color: "#7A5A8A", available: 1, total: 1 },
    { img: "/comodin-elegir.png", label: "ELEGIR RIVAL", color: "#5B8C5A", available: 1, total: 1 },
    { img: "/comodin-invocar.png", label: "INVOCAR PRO", color: "#C44536", available: 1, total: 1 },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <img src={emblemUrl} alt="" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#f2eef7" }}>{teamName}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {comodines.map((c) => (
          <div key={c.label} style={{
            padding: "10px",
            background: `${c.color}15`,
            border: `1px solid ${c.color}55`,
            borderRadius: "10px",
            textAlign: "center",
          }}>
            <img src={c.img} alt={c.label} style={{ width: "100%", maxHeight: "60px", objectFit: "contain", marginBottom: "6px" }} />
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: c.color }}>{c.label}</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: c.color, fontFamily: "Inter, sans-serif" }}>{c.available}/{c.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
