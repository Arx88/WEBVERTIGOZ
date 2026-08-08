"use client";
import { useState } from "react";
import { useWizard } from "@/components/wizard/wizard-context";

const REINOS = [
  { id: "r1", img: "/reinos/reino-1.webp" },
  { id: "r2", img: "/reinos/reino-2.webp" },
  { id: "r3", img: "/reinos/reino-3.webp" },
  { id: "r4", img: "/reinos/reino-4.webp" },
  { id: "r5", img: "/reinos/reino-5.webp" },
  { id: "r6", img: "/reinos/reino-6.webp" },
  { id: "r7", img: "/reinos/reino-7.webp" },
  { id: "r8", img: "/reinos/reino-8.webp" },
  { id: "r9", img: "/reinos/reino-9.webp" },
  { id: "r10", img: "/reinos/reino-10.webp" },
  { id: "r11", img: "/reinos/reino-11.webp" },
  { id: "r12", img: "/reinos/reino-12.webp" },
  { id: "r13", img: "/reinos/reino-13.webp" },
];

export default function Step2TeamData() {
  const { data, updateData } = useWizard();
  const [reinoIndex, setReinoIndex] = useState(0);

  const selectedReino = REINOS[reinoIndex];
  const isSelected = data.emblemId === selectedReino.id;

  function goPrev() {
    const next = reinoIndex === 0 ? REINOS.length - 1 : reinoIndex - 1;
    setReinoIndex(next);
  }

  function goNext() {
    const next = reinoIndex === REINOS.length - 1 ? 0 : reinoIndex + 1;
    setReinoIndex(next);
  }

  function selectReino() {
    updateData({ emblemId: selectedReino.id });
  }

  // Auto-seleccionar al navegar
  function goPrevAndSelect() {
    const next = reinoIndex === 0 ? REINOS.length - 1 : reinoIndex - 1;
    setReinoIndex(next);
    updateData({ emblemId: REINOS[next].id });
  }

  function goNextAndSelect() {
    const next = reinoIndex === REINOS.length - 1 ? 0 : reinoIndex + 1;
    setReinoIndex(next);
    updateData({ emblemId: REINOS[next].id });
  }

  return (
    <>
      <div className="field">
        <label htmlFor="teamName">Nombre de tu Reino</label>
        <input
          id="teamName"
          type="text"
          placeholder="Ej: Reino de los Invencibles"
          value={data.teamName}
          onChange={(e) => updateData({ teamName: e.target.value })}
          maxLength={60}
        />
      </div>

      <div className="field">
        <label htmlFor="teamTagline">
          Lema del Reino <small>(opcional)</small>
        </label>
        <input
          id="teamTagline"
          type="text"
          placeholder="Ej: Honor et gloria"
          value={data.teamTagline}
          onChange={(e) => updateData({ teamTagline: e.target.value })}
          maxLength={140}
        />
      </div>

      {/* Selector de escudo — una imagen grande con flechas */}
      <div style={{ maxWidth: "560px" }}>
        <div className="chips-head">
          <span className={`counter ${isSelected ? "full" : ""}`}>
            {isSelected ? "✓ Escudo elegido" : "Elegí tu escudo"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
            padding: "24px 0",
          }}
        >
          {/* Flecha izquierda */}
          <button
            onClick={goPrevAndSelect}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              border: "1px solid var(--input-border)",
              background: "var(--input-bg)",
              color: "var(--muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s var(--ease)",
              flex: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--purple)";
              e.currentTarget.style.color = "var(--purple-pale)";
              e.currentTarget.style.background = "rgba(124,58,237,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--input-border)";
              e.currentTarget.style.color = "var(--muted)";
              e.currentTarget.style.background = "var(--input-bg)";
            }}
            aria-label="Escudo anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Imagen grande del escudo */}
          <div
            key={selectedReino.id}
            style={{
              width: "200px",
              height: "200px",
              borderRadius: "16px",
              overflow: "hidden",
              border: `2px solid ${isSelected ? "var(--purple)" : "var(--input-border)"}`,
              background: "var(--input-bg)",
              boxShadow: isSelected
                ? "0 0 0 1px var(--purple), 0 0 24px rgba(124,58,237,0.2), 0 8px 32px rgba(0,0,0,0.4)"
                : "0 4px 16px rgba(0,0,0,0.3)",
              transition: "all 0.3s var(--ease)",
              animation: "reinoFadeIn 0.3s var(--ease)",
              position: "relative",
            }}
          >
            <style>{`
              @keyframes reinoFadeIn {
                from { opacity: 0; transform: scale(0.92); }
                to { opacity: 1; transform: scale(1); }
              }
            `}</style>
            <img
              src={selectedReino.img}
              alt={`Escudo ${reinoIndex + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>

          {/* Flecha derecha */}
          <button
            onClick={goNextAndSelect}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              border: "1px solid var(--input-border)",
              background: "var(--input-bg)",
              color: "var(--muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s var(--ease)",
              flex: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--purple)";
              e.currentTarget.style.color = "var(--purple-pale)";
              e.currentTarget.style.background = "rgba(124,58,237,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--input-border)";
              e.currentTarget.style.color = "var(--muted)";
              e.currentTarget.style.background = "var(--input-bg)";
            }}
            aria-label="Escudo siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Counter */}
        <div
          style={{
            textAlign: "center",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "1.5px",
            color: "var(--faint)",
            fontFamily: "Inter, sans-serif",
            marginBottom: "16px",
          }}
        >
          {reinoIndex + 1} / {REINOS.length}
        </div>
      </div>

      {/* Preview del reino */}
      {data.teamName && isSelected && (
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "rgba(124,58,237,0.04)",
            border: "1px solid rgba(124,58,237,0.15)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            maxWidth: "560px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid rgba(124,58,237,0.3)",
              flex: "none",
            }}
          >
            <img
              src={selectedReino.img}
              alt="Escudo"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div>
            <div
              style={{
                fontFamily: "Cinzel, serif",
                fontSize: "17px",
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              {data.teamName}
            </div>
            {data.teamTagline && (
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--muted)",
                  fontStyle: "italic",
                  marginTop: "2px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                &ldquo;{data.teamTagline}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
