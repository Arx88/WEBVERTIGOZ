import { CalendarClock, Hourglass, AlertTriangle } from "lucide-react";

/**
 * Banner "horario a confirmar" — estado PENDIENTE (oro), no un error.
 * Sin markup de servidor ni hooks: se puede importar desde server y client
 * components. El rojo queda reservado para W.O. / tolerancia.
 */
export function NoDateBanner({
  kicker = "AVISO DE LA ORGANIZACIÓN",
  description = "Esta llave todavía no tiene fecha y hora confirmadas. Apenas se publique el horario se abre la ventana de READY.",
}: {
  kicker?: string;
  description?: string;
}) {
  return (
    <div className="vertigo-nodate" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div className="vertigo-nodate-medallion">
          <CalendarClock style={{ width: 19, height: 19 }} strokeWidth={1.75} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2.2px", color: "var(--vertigo-gold)", opacity: 0.85 }}>
            {kicker}
          </div>
          <div
            className="font-cinzel"
            style={{ fontSize: 15, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#e9d18a", marginTop: 3 }}
          >
            Horario a confirmar
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--vertigo-muted)", margin: "6px 0 0" }}>
            {description}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <span className="vertigo-nodate-rule">
              <Hourglass style={{ width: 11, height: 11, color: "var(--vertigo-gold)" }} />
              READY: desde 15 min antes del horario
            </span>
            <span className="vertigo-nodate-rule">
              <AlertTriangle style={{ width: 11, height: 11, color: "var(--vertigo-danger)" }} />
              Sin confirmación a tiempo: W.O.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
