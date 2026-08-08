"use client";
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
  const selectedReino = REINOS.find(r => r.id === data.emblemId);

  return (
    <>
      <div className="field">
        <label htmlFor="teamName">Nombre de tu Reino</label>
        <input id="teamName" type="text" placeholder="Ej: Reino de los Invencibles" value={data.teamName}
          onChange={(e) => updateData({ teamName: e.target.value })} maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="teamTagline">Lema del Reino <small>(opcional)</small></label>
        <input id="teamTagline" type="text" placeholder="Ej: Honor et gloria" value={data.teamTagline}
          onChange={(e) => updateData({ teamTagline: e.target.value })} maxLength={140} />
      </div>

      {/* Selector de escudo de reino — carrusel horizontal */}
      <div className="chips-head">
        <span className={`counter ${data.emblemId ? "full" : ""}`}>
          {data.emblemId ? "✓ Escudo elegido" : "Elegí tu escudo"}
        </span>
      </div>

      {/* Carrusel horizontal con scroll */}
      <div style={{
        display: "flex",
        gap: "12px",
        overflowX: "auto",
        padding: "8px 4px 16px",
        maxWidth: "640px",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--line) transparent",
      }}
      className="vertigo-scroll">
        <style>{`
          .vertigo-scroll::-webkit-scrollbar { height: 6px; }
          .vertigo-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 6px; }
          .vertigo-scroll::-webkit-scrollbar-track { background: transparent; }
        `}</style>
        {REINOS.map((reino) => {
          const sel = data.emblemId === reino.id;
          return (
            <button
              key={reino.id}
              onClick={() => updateData({ emblemId: reino.id })}
              style={{
                flex: "none",
                width: "72px",
                height: "72px",
                borderRadius: "12px",
                overflow: "hidden",
                border: `2px solid ${sel ? "var(--purple)" : "transparent"}`,
                cursor: "pointer",
                transition: "all 0.25s var(--ease)",
                background: sel ? "rgba(124,58,237,0.12)" : "var(--input-bg)",
                boxShadow: sel ? "0 0 0 3px rgba(124,58,237,0.12), 0 4px 18px rgba(124,58,237,0.22)" : "none",
                padding: 0,
              }}
            >
              <img
                src={reino.img}
                alt={`Escudo ${reino.id}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          );
        })}
      </div>

      {/* Preview del reino elegido */}
      {selectedReino && data.teamName && (
        <div style={{
          marginTop: "20px",
          padding: "20px",
          background: "rgba(124,58,237,0.04)",
          border: "1px solid rgba(124,58,237,0.15)",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          maxWidth: "560px",
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid rgba(124,58,237,0.3)",
            flex: "none",
          }}>
            <img src={selectedReino.img} alt="Escudo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <div style={{ fontFamily: "Cinzel, serif", fontSize: "18px", fontWeight: 600, color: "var(--text)" }}>
              {data.teamName}
            </div>
            {data.teamTagline && (
              <div style={{ fontSize: "13px", color: "var(--muted)", fontStyle: "italic", marginTop: "4px" }}>
                &ldquo;{data.teamTagline}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
