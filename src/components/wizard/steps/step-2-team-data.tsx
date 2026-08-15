"use client";
import { useState, useEffect } from "react";
import { useWizard } from "@/components/wizard/wizard-context";

interface Emblem {
  id: string;
  name: string;
  image_url: string;
  sort_order: number;
}

export default function Step2TeamData() {
  const { data, updateData } = useWizard();
  const [emblems, setEmblems] = useState<Emblem[]>([]);
  const [emblemsLoad, setEmblemsLoad] = useState<"loading" | "ok" | "error">("loading");

  const selected = emblems.find((e) => e.id === data.emblemId) ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/emblems");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = json.emblems as Emblem[] | undefined;
        if (!cancelled) {
          setEmblems(Array.isArray(list) ? list : []);
          setEmblemsLoad("ok");
        }
      } catch {
        if (!cancelled) setEmblemsLoad("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

      {/* Selector de escudo — emblemas reales de la BD */}
      <div style={{ maxWidth: "640px", marginBottom: "16px" }}>
        <div className="chips-head" style={{ marginBottom: "14px" }}>
          <span className={`counter ${selected ? "full" : ""}`}>
            {emblemsLoad === "loading" && "Cargando emblemas…"}
            {emblemsLoad === "error" && "No pudimos cargar los emblemas"}
            {emblemsLoad === "ok" && (selected ? `✓ ${selected.name} (${emblems.length} emblemas)` : "Elegí tu escudo")}
          </span>
        </div>

        {emblemsLoad === "error" && (
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "10px",
              background: "rgba(251,113,133,0.08)",
              border: "1px solid rgba(251,113,133,0.25)",
              color: "var(--vertigo-danger)",
              fontSize: 13,
            }}
          >
            No pudimos cargar los emblemas. Actualizá la página para reintentar.
          </div>
        )}

        {emblemsLoad === "ok" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
              gap: "10px",
            }}
          >
            {emblems.map((emblem) => {
              const isSelected = data.emblemId === emblem.id;
              return (
                <button
                  key={emblem.id}
                  type="button"
                  onClick={() => updateData({ emblemId: emblem.id })}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    padding: "14px 8px 12px",
                    borderRadius: "12px",
                    background: "var(--input-bg)",
                    border: `2px solid ${isSelected ? "var(--purple)" : "var(--input-border)"}`,
                    boxShadow: isSelected
                      ? "0 0 0 2px var(--purple), 0 0 24px rgba(124,58,237,0.3), 0 8px 24px rgba(0,0,0,0.45)"
                      : "none",
                    transform: isSelected ? "translateY(-3px)" : "translateY(0)",
                    cursor: "pointer",
                    transition: "all 0.25s cubic-bezier(.22,1,.36,1)",
                  }}
                  aria-pressed={isSelected}
                  aria-label={`Escudo ${emblem.name}${isSelected ? " (seleccionado)" : ""}`}
                >
                  <img
                    src={emblem.image_url}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    draggable={false}
                    style={{ width: 56, height: 56, objectFit: "contain", display: "block" }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.8px",
                      textTransform: "uppercase",
                      textAlign: "center",
                      lineHeight: 1.3,
                      color: isSelected ? "var(--purple-pale)" : "var(--muted)",
                    }}
                  >
                    {emblem.name}
                  </span>
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--purple)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 0 10px rgba(124,58,237,0.6)",
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
