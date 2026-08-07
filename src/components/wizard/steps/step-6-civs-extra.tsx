"use client";

import { useWizard } from "@/components/wizard/wizard-context";

const AOE2_CIVS = [
  { id: "britons", name: "Britanos" }, { id: "franks", name: "Francos" },
  { id: "goths", name: "Godos" }, { id: "teutons", name: "Teutones" },
  { id: "japanese", name: "Japoneses" }, { id: "chinese", name: "Chinos" },
  { id: "byzantines", name: "Bizantinos" }, { id: "persians", name: "Persas" },
  { id: "saracens", name: "Sarracenos" }, { id: "turks", name: "Turcos" },
  { id: "vikings", name: "Vikingos" }, { id: "mongols", name: "Mongoles" },
  { id: "celts", name: "Celtas" }, { id: "spanish", name: "Españoles" },
  { id: "aztecs", name: "Aztecas" }, { id: "mayans", name: "Mayas" },
  { id: "huns", name: "Hunos" }, { id: "koreans", name: "Coreanos" },
  { id: "italians", name: "Italianos" }, { id: "indians", name: "Hindúes" },
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
  const selected = data.extraCivIds;
  const baseCivIds = data.baseCivIds;
  const TARGET = 3;

  function toggleCiv(civId: string) {
    if (selected.includes(civId)) {
      updateData({ extraCivIds: selected.filter((id) => id !== civId) });
    } else if (selected.length < TARGET) {
      updateData({ extraCivIds: [...selected, civId] });
    }
  }

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "10px", color: "rgba(255, 46, 158, 0.7)", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "8px" }}>
          PASO 06
        </div>
        <h1 style={{ fontSize: "26px", fontWeight: 600, color: "#f5eaff", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
          Elegí 3 civs extra (para la final)
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "20px", alignItems: "start" }}>
        {/* Grilla */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: "6px",
          maxHeight: "380px",
          overflowY: "auto",
          paddingRight: "4px",
        }}
        className="vertigo-scroll"
        >
          {AOE2_CIVS.map((civ) => {
            const isSelected = selected.includes(civ.id);
            const isBase = baseCivIds.includes(civ.id);
            const order = selected.indexOf(civ.id) + 1;
            const disabled = isBase || (!isSelected && selected.length >= TARGET);

            return (
              <button
                key={civ.id}
                onClick={() => !isBase && toggleCiv(civ.id)}
                disabled={disabled}
                style={{
                  aspectRatio: "1",
                  padding: "8px",
                  borderRadius: "4px",
                  background: isSelected ? "rgba(255, 46, 158, 0.12)" : "rgba(255, 46, 158, 0.03)",
                  border: `1px solid ${isSelected ? "#ff2e9e" : "rgba(255, 46, 158, 0.12)"}`,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: isBase ? 0.25 : disabled ? 0.3 : 1,
                  transition: "all 200ms ease",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                {isSelected && (
                  <div style={{
                    position: "absolute", top: "3px", right: "3px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: "#ff2e9e", color: "#0a0011",
                    fontSize: "9px", fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {order}
                  </div>
                )}
                {isBase && (
                  <div style={{
                    position: "absolute", top: "3px", right: "3px",
                    fontSize: "9px", color: "rgba(255, 180, 220, 0.3)",
                  }}>
                    ✓
                  </div>
                )}
                <div style={{
                  fontSize: "20px", fontWeight: 700,
                  color: isSelected ? "#ff2e9e" : "rgba(255, 180, 220, 0.4)",
                }}>
                  {civ.name.charAt(0)}
                </div>
                <div style={{
                  fontSize: "9px", color: isSelected ? "#f5eaff" : "rgba(255, 180, 220, 0.4)",
                  textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase",
                }}>
                  {civ.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar */}
        <div style={{
          padding: "16px",
          background: "rgba(255, 46, 158, 0.04)",
          border: "1px solid rgba(255, 46, 158, 0.15)",
          borderRadius: "4px",
          position: "sticky", top: "0",
        }}>
          <div style={{ fontSize: "10px", color: "rgba(255, 180, 220, 0.6)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "8px" }}>
            CIVS EXTRA
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#ff2e9e", marginBottom: "12px" }}>
            {selected.length}<span style={{ fontSize: "14px", color: "rgba(255, 180, 220, 0.4)" }}>/{TARGET}</span>
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255, 180, 220, 0.5)", marginBottom: "8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Pool total
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: "#f5eaff" }}>
            9 + {selected.length} = {9 + selected.length}<span style={{ fontSize: "12px", color: "rgba(255, 180, 220, 0.4)" }}>/ 12</span>
          </div>
        </div>
      </div>
    </div>
  );
}
