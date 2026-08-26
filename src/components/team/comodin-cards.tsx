/**
 * Grilla de comodines del equipo, compartida por /mi-equipo y el
 * perfil público /equipos/[id].
 */
export interface ComodinRow {
  rerollAvailable: number;
  anularAvailable: number;
  elegirRivalAvailable: number;
  invocarProAvailable: number;
}

function ComodinCard({ icon, label, value, desc }: { icon: string; label: string; value: number; desc: string }) {
  const isAvailable = value > 0;
  return (
    <div
      className="vertigo-info-card"
      style={{
        display: "flex", alignItems: "center", gap: "14px",
        opacity: isAvailable ? 1 : 0.75,
      }}
    >
      {/* Icono de marca del comodín */}
      <div
        style={{
          width: "58px", height: "58px", flex: "none", borderRadius: "14px",
          overflow: "hidden",
          border: `1.5px solid ${isAvailable ? "rgba(212,175,55,0.45)" : "var(--vertigo-line)"}`,
          boxShadow: isAvailable ? "0 0 18px rgba(124,58,237,0.35), 0 4px 12px rgba(0,0,0,0.4)" : "none",
          filter: isAvailable ? "none" : "grayscale(1) brightness(0.7)",
        }}
      >
        <img src={icon} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="vertigo-info-card-label">{label}</div>
        <div className="vertigo-info-card-value" style={{ fontFamily: "var(--font-cinzel), Cinzel, serif", fontSize: 26 }}>
          <span style={{ color: isAvailable ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)" }}>
            {value}
          </span>
          <span className="text-[11px] text-[var(--vertigo-faint)] ml-2">disp.</span>
        </div>
        <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">{desc}</div>
      </div>
    </div>
  );
}

export function ComodinesGrid({ comodin }: { comodin: ComodinRow }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}
    >
      <ComodinCard icon="/comodines/reroll.webp" label="Reroll" value={comodin.rerollAvailable} desc="Re-girar fase" />
      <ComodinCard icon="/comodines/anular.webp" label="Anular" value={comodin.anularAvailable} desc="Anular jugador rival" />
      <ComodinCard icon="/comodines/elegir-rival.webp" label="Elegir rival" value={comodin.elegirRivalAvailable} desc="Elegir oponente" />
      <ComodinCard icon="/comodines/invocar-pro.webp" label="Invocar PRO" value={comodin.invocarProAvailable} desc="Refuerzo profesional" />
    </div>
  );
}
