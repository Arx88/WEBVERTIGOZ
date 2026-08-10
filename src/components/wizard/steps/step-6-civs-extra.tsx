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
  { id: "armenians", name: "Armenios" }, { id: "georgians", name: "Georgianos" },
  { id: "bengalis", name: "Bengalíes" }, { id: "dravidians", name: "Drávidas" },
  { id: "gurjaras", name: "Gurjaras" },
  { id: "jurchens", name: "Jurchen" }, { id: "khitans", name: "Kitan" },
  { id: "shu", name: "Shu" }, { id: "wei", name: "Wei" },
  { id: "wu", name: "Wu" },
  { id: "mapuche", name: "Mapuche" }, { id: "muiscas", name: "Muiscas" },
  { id: "tupies", name: "Tupies" },
];

export default function Step6CivsExtra() {
  const { data, updateData } = useWizard();
  const sel = data.extraCivIds;
  const base = data.baseCivIds;
  const MAX = 3;
  const toggle = (civId: string) => {
    if (base.includes(civId)) return;
    if (sel.includes(civId)) updateData({ extraCivIds: sel.filter((x) => x !== civId) });
    else if (sel.length < MAX) updateData({ extraCivIds: [...sel, civId] });
  };
  return (
    <>
      <div className="chips-head">
        <span className={`counter ${sel.length === MAX ? "full" : ""}`}>{sel.length} / {MAX} · Pool total: {9 + sel.length}/12</span>
      </div>
      <div className="chips" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: "10px", maxWidth: "720px" }}>
        {CIVS.map((c) => {
          const isSelected = sel.includes(c.id);
          const isBase = base.includes(c.id);
          const order = sel.indexOf(c.id) + 1;
          const disabled = isBase || (!isSelected && sel.length >= MAX);
          return (
            <button
              key={c.id}
              className={`chip ${isSelected ? "sel" : ""}`}
              onClick={() => toggle(c.id)}
              disabled={disabled}
              style={{
                opacity: isBase ? 0.2 : disabled ? 0.25 : 1,
                padding: "12px 8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                position: "relative",
                transition: "all 0.2s cubic-bezier(.22,1,.36,1)",
                cursor: disabled ? "not-allowed" : "pointer",
                borderColor: isSelected ? "rgba(212,175,55,0.6)" : isBase ? "rgba(124,58,237,0.3)" : undefined,
                boxShadow: isSelected ? "0 0 12px rgba(212,175,55,0.2), 0 0 0 1px rgba(212,175,55,0.3)" : isBase ? "0 0 8px rgba(124,58,237,0.15)" : undefined,
                background: isSelected ? "linear-gradient(180deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05))" : isBase ? "rgba(124,58,237,0.06)" : undefined,
              }}
            >
              {isSelected && (
                <span style={{
                  position: "absolute", top: "4px", right: "4px",
                  width: "18px", height: "18px", borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(212,175,55,1), rgba(180,130,20,1))",
                  color: "#0a0011", fontSize: "10px", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 8px rgba(212,175,55,0.5)",
                }}>
                  {order}
                </span>
              )}
              {isBase && (
                <span style={{
                  position: "absolute", top: "4px", right: "4px",
                  width: "18px", height: "18px", borderRadius: "50%",
                  background: "var(--purple)",
                  color: "#fff", fontSize: "10px", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  ✓
                </span>
              )}
              <div style={{
                width: "44px", height: "44px",
                borderRadius: "8px",
                overflow: "hidden",
                border: `1.5px solid ${isSelected ? "rgba(212,175,55,0.4)" : isBase ? "rgba(124,58,237,0.3)" : "var(--input-border)"}`,
                background: "var(--input-bg)",
              }}>
                <img
                  src={`/civs/${c.id}.webp`}
                  alt={c.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: isBase ? 0.4 : 1 }}
                />
              </div>
              <span style={{
                fontSize: "10px",
                fontWeight: isSelected ? 600 : 500,
                textAlign: "center",
                letterSpacing: "0.3px",
                color: isSelected ? "#e8c56a" : isBase ? "var(--purple-pale)" : undefined,
                transition: "color 0.2s",
              }}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
