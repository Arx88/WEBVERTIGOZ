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
  { id: "italians", name: "Italianos" }, { id: "hindustanis", name: "Hindus" },
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
  { id: "gurjaras", name: "Gurjaras" }, { id: "jurchens", name: "Jurchen" },
  { id: "khitans", name: "Kitan" }, { id: "shu", name: "Shu" },
  { id: "wei", name: "Wei" }, { id: "wu", name: "Wu" },
  { id: "mapuche", name: "Mapuche" }, { id: "muiscas", name: "Muiscas" },
  { id: "tupies", name: "Tupies" },
];

export default function Step6CivsExtra() {
  const { data, updateData, config } = useWizard();
  const sel = data.extraCivIds;
  const base = data.baseCivIds;
  const MAX = config.civsExtra;

  const available = CIVS.filter((c) => !base.includes(c.id));

  const toggle = (civId: string) => {
    if (sel.includes(civId)) updateData({ extraCivIds: sel.filter((x) => x !== civId) });
    else if (sel.length < MAX) updateData({ extraCivIds: [...sel, civId] });
  };

  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--vertigo-faint)",
            }}
          >
            Civilizaciones extra
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: sel.length === MAX ? "var(--vertigo-success)" : sel.length > 0 ? "var(--vertigo-warning)" : "var(--vertigo-muted)",
              background: sel.length === MAX ? "rgba(34,197,84,0.15)" : sel.length > 0 ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.03)",
              padding: "4px 10px",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: sel.length === MAX ? "rgba(34,197,84,0.3)" : sel.length > 0 ? "rgba(251,191,36,0.3)" : "var(--vertigo-line)",
            }}
          >
            {sel.length} / {MAX}
          </span>
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--vertigo-muted)",
            marginBottom: "16px",
            maxWidth: "640px",
            lineHeight: 1.6,
          }}
        >
          Elegí <strong>{MAX} civilizaciones adicionales</strong> para la gran final. 
          Solo activas si ganás el bracket. Se suman a tus {config.civsBase} civs base — elegí distintas.
        </p>
      </div>

      {available.length === 0 ? (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            background: "rgba(124,58,237,0.05)",
            border: "1px solid rgba(124,58,237,0.15)",
            borderRadius: "10px",
            color: "var(--vertigo-muted)",
            fontSize: 13,
          }}
        >
          Ya elegiste todas las civs disponibles en el pool base.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
            gap: "8px",
            maxWidth: "700px",
          }}
        >
          {available.map((c) => {
            const isSelected = sel.includes(c.id);
            const order = sel.indexOf(c.id) + 1;
            const isDisabled = !isSelected && sel.length >= MAX;
            const isBase = base.includes(c.id);

            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                disabled={isDisabled}
                title={`${c.name} — ${isSelected ? `Extra (${order})` : "Click para agregar"}`}
                style={{
                  position: "relative",
                  padding: "6px",
                  borderRadius: "10px",
                  background: isSelected
                    ? "rgba(251,191,36,0.12)"
                    : isDisabled
                      ? "rgba(0,0,0,0.2)"
                      : "var(--vertigo-input-bg)",
                  border: `2px solid ${
                    isSelected
                      ? "var(--vertigo-warning)"
                      : isDisabled
                        ? "rgba(255,255,255,0.08)"
                        : "var(--vertigo-line)"
                  }`,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  transition: "all 0.2s cubic-bezier(.22,1,.36,1)",
                  boxShadow: isSelected
                    ? "0 0 12px rgba(251,191,36,0.25), 0 2px 8px rgba(0,0,0,0.3)"
                    : "0 2px 6px rgba(0,0,0,0.2)",
                  opacity: isDisabled ? 0.4 : isBase ? 0.3 : 1,
                  transform: isSelected ? "scale(1.03)" : "scale(1)",
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled && !isSelected) {
                    e.currentTarget.style.borderColor = "var(--vertigo-warning)";
                    e.currentTarget.style.background = "rgba(251,191,36,0.08)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled && !isSelected) {
                    e.currentTarget.style.borderColor = "var(--vertigo-line)";
                    e.currentTarget.style.background = "var(--vertigo-input-bg)";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
              >
                {/* Imagen */}
                <div
                  style={{
                    aspectRatio: "1",
                    borderRadius: "6px",
                    overflow: "hidden",
                    background: "var(--vertigo-bg-deep)",
                    marginBottom: "4px",
                  }}
                >
                  <img
                    src={`/civs/${c.id}.webp`}
                    alt={c.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>

                {/* Nombre */}
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textAlign: "center",
                    color: isSelected ? "var(--vertigo-warning)" : isDisabled ? "var(--vertigo-faint)" : "var(--vertigo-text)",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    lineHeight: 1.2,
                  }}
                >
                  {c.name}
                </div>

                {/* Badge de orden */}
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "var(--vertigo-warning)",
                      color: "#000",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 8px rgba(251,191,36,0.5)",
                    }}
                  >
                    {order}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
