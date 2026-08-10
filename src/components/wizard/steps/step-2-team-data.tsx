"use client";
import { useState, useMemo } from "react";
import { useWizard } from "@/components/wizard/wizard-context";

// Imágenes de referencia conocidas del torneo (de la landing)
const REINO_IMGS = [
  "/landing/fondo-castillo.webp",
  "/landing/hero.webp",
  "/landing/monje-trofeo.webp",
  "/landing/universidad.webp",
];
// Y reinos si existen
const REINOS = Array.from({ length: 13 }, (_, i) => ({
  id: `reino-${i + 1}`,
  img: `/reinos/reino-${i + 1}.webp`,
  fallback: REINO_IMGS[i % REINO_IMGS.length],
}));

export default function Step2TeamData() {
  const { data, updateData } = useWizard();
  const [activeIdx, setActiveIdx] = useState(0);
  const selectedEmblemId = data.emblemId;

  const selectedReino = REINOS[activeIdx];
  const isSelected = selectedEmblemId === selectedReino.id;

  const gridCols = useMemo(() => {
    if (typeof window === "undefined") return 7;
    const w = window.innerWidth;
    if (w >= 1200) return 7;
    if (w >= 900) return 6;
    if (w >= 600) return 4;
    return 3;
  }, []);

  const goPrev = () => setActiveIdx((i) => (i === 0 ? REINOS.length - 1 : i - 1));
  const goNext = () => setActiveIdx((i) => (i === REINOS.length - 1 ? 0 : i + 1));

  const selectReino = (idx: number) => {
    setActiveIdx(idx);
    updateData({ emblemId: REINOS[idx].id });
  };

  return (
    <>
      {/* Nombre del reino */}
      <div className="field" style={{ marginBottom: "28px" }}>
        <label htmlFor="teamName">Nombre de tu Reino</label>
        <input
          id="teamName"
          type="text"
          placeholder="Ej: Reino de los Invencibles"
          value={data.teamName}
          onChange={(e) => updateData({ teamName: e.target.value })}
          maxLength={60}
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "18px",
            fontWeight: 700,
            letterSpacing: "1px",
            height: "56px",
            padding: "0 20px",
          }}
        />
      </div>

      {/* Lema opcional */}
      <div className="field" style={{ marginBottom: "28px" }}>
        <label htmlFor="teamTagline">
          Lema del Reino <small style={{ fontWeight: 400 }}>(opcional)</small>
        </label>
        <input
          id="teamTagline"
          type="text"
          placeholder="Ej: Honor et gloria"
          value={data.teamTagline}
          onChange={(e) => updateData({ teamTagline: e.target.value })}
          maxLength={140}
          style={{ fontStyle: "italic" }}
        />
      </div>

      {/* Selector de escudo — galería visual */}
      <div style={{ maxWidth: "640px", marginBottom: "16px" }}>
        <div className="chips-head" style={{ marginBottom: "14px" }}>
          <span className={`counter ${isSelected ? "full" : ""}`}>
            {isSelected ? `✓ Escudo ${activeIdx + 1}/${REINOS.length}` : "Elegí tu escudo"}
          </span>
        </div>

        {/* Preview grande arriba */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "20px",
        }}>
          <div
            key={selectedReino.id}
            style={{
              width: "180px",
              height: "180px",
              borderRadius: "16px",
              overflow: "hidden",
              border: `3px solid ${isSelected ? "var(--purple)" : "var(--input-border)"}`,
              background: "var(--input-bg)",
              boxShadow: isSelected
                ? `0 0 0 2px var(--purple), 0 0 32px rgba(124,58,237,0.3), 0 12px 40px rgba(0,0,0,0.5)`
                : "0 4px 20px rgba(0,0,0,0.4)",
              transition: "all 0.35s cubic-bezier(.22,1,.36,1)",
              animation: "reinoFadeIn 0.4s cubic-bezier(.22,1,.36,1)",
              flex: "none",
            }}
          >
            <style>{`
              @keyframes reinoFadeIn {
                from { opacity: 0; transform: scale(0.94) rotate(-2deg); }
                to { opacity: 1; transform: scale(1) rotate(0); }
              }
            `}</style>
            <img
              src={selectedReino.img}
              alt={`Escudo ${activeIdx + 1}`}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.endsWith(REINO_IMGS[activeIdx % REINO_IMGS.length])) {
                  target.src = REINO_IMGS[activeIdx % REINO_IMGS.length];
                }
              }}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Grid de thumbnails */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gap: "8px",
        }}>
          {REINOS.map((r, idx) => {
            const active = idx === activeIdx;
            const chosen = selectedEmblemId === r.id;
            return (
              <button
                key={r.id}
                onClick={() => selectReino(idx)}
                style={{
                  aspectRatio: "1",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: `2px solid ${chosen ? "var(--purple)" : active ? "rgba(124,58,237,0.5)" : "var(--input-border)"}`,
                  background: "var(--input-bg)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: chosen
                    ? "0 0 12px rgba(124,58,237,0.35)"
                    : active
                      ? "0 0 8px rgba(124,58,237,0.2)"
                      : "none",
                  opacity: chosen || active ? 1 : 0.5,
                  transform: chosen ? "scale(1.06)" : "scale(1)",
                  padding: 0,
                  position: "relative",
                }}
                aria-label={`Escudo ${idx + 1}${chosen ? " (seleccionado)" : ""}`}
              >
                <img
                  src={r.img}
                  alt=""
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.endsWith(REINO_IMGS[idx % REINO_IMGS.length])) {
                      target.src = REINO_IMGS[idx % REINO_IMGS.length];
                    }
                  }}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {chosen && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(124,58,237,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
