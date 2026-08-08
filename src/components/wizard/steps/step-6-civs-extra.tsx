"use client";
import { useWizard } from "@/components/wizard/wizard-context";

const CIVS = [
  { id: "britons", name: "Britanos" }, { id: "franks", name: "Francos" },
  { id: "goths", name: "Godos" }, { id: "teutons", name: "Teutones" },
  { id: "japanese", name: "Japoneses" }, { id: "chinese", name: "Chinos" },
  { id: "byzantines", name: "Bizantinos" }, { id: "persians", name: "Persas" },
  { id: "saracens", name: "Sarracenos" }, { id: "turks", name: "Turcos" },
  { id: "vikings", name: "Vikingos" }, { id: "mongols", name: "Mongoles" },
  { id: "celts", name: "Celtas" }, { id: "spanish", name: "Españoles" },
  { id: "aztecs", name: "Aztecas" }, { id: "mayans", name: "Mayas" },
  { id: "huns", name: "Hunos" }, { id: "koreans", name: "Coreanos" },
  { id: "italians", name: "Italianos" }, { id: "hindustanis", name: "Hindúes" },
  { id: "incas", name: "Incas" }, { id: "magyars", name: "Magiares" },
  { id: "slavs", name: "Eslavos" }, { id: "berbers", name: "Bereberes" },
  { id: "ethiopians", name: "Etíopes" }, { id: "malians", name: "Malianos" },
  { id: "portuguese", name: "Portugueses" }, { id: "burmese", name: "Birmanos" },
  { id: "khmer", name: "Jémeres" }, { id: "malay", name: "Malayos" },
  { id: "vietnamese", name: "Vietnamitas" }, { id: "bulgarians", name: "Búlgaros" },
  { id: "cumans", name: "Cumanos" }, { id: "lithuanians", name: "Lituanos" },
  { id: "tatars", name: "Tártaros" }, { id: "burgundians", name: "Borgoñones" },
  { id: "sicilians", name: "Sicilianos" }, { id: "poles", name: "Polacos" },
  { id: "bohemians", name: "Bohemios" }, { id: "romans", name: "Romanos" },
];

export default function Step6CivsExtra() {
  const { data, updateData } = useWizard();
  const sel = data.extraCivIds;
  const base = data.baseCivIds;
  const MAX = 3;
  const toggle = (c: string) => {
    if (base.includes(c)) return;
    if (sel.includes(c)) updateData({ extraCivIds: sel.filter((x) => x !== c) });
    else if (sel.length < MAX) updateData({ extraCivIds: [...sel, c] });
  };
  return (
    <>
      <div className="chips-head">
        <span className={`counter ${sel.length === MAX ? "full" : ""}`}>{sel.length} / {MAX} · Pool total: {9 + sel.length}/12</span>
      </div>
      <div className="chips" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: "8px", maxWidth: "720px" }}>
        {CIVS.map((c) => {
          const isSelected = sel.includes(c.id);
          const isBase = base.includes(c.id);
          const order = sel.indexOf(c.id) + 1;
          const disabled = isBase || (!isSelected && sel.length >= MAX);
          return (
            <button key={c.id} className={`chip ${isSelected ? "sel" : ""}`} onClick={() => toggle(c)} disabled={disabled}
              style={{ opacity: isBase ? 0.25 : disabled ? 0.3 : 1, padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", position: "relative" }}>
              {isSelected && (
                <span style={{ position: "absolute", top: "4px", right: "4px", width: "18px", height: "18px", borderRadius: "50%", background: "var(--purple)", color: "#0a0011", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {order}
                </span>
              )}
              {isBase && (
                <span style={{ position: "absolute", top: "4px", right: "4px", fontSize: "11px", color: "var(--purple-pale)" }}>✓</span>
              )}
              <img src={`/civs/${c.id}.webp`} alt={c.name} style={{ width: "40px", height: "40px", objectFit: "contain", opacity: isBase ? 0.5 : 1 }} />
              <span style={{ fontSize: "10px", fontWeight: 500, textAlign: "center", letterSpacing: "0.3px" }}>{c.name}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
