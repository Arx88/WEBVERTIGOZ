"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Swords, Trophy } from "lucide-react";
import { Modal } from "@/components/ui/modal";

const FLAG_KEY = "vertigo-apuestas-welcome-v1";

/**
 * Pop-up de bienvenida: aparece la primera vez que el espectador entra
 * al hub /apuestas. Muestra los puntos de bienvenida y las reglas.
 */
export default function WelcomePointsModal({ points }: { points: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(FLAG_KEY)) setOpen(true);
    } catch {
      // localStorage bloqueado → no mostramos el pop-up
    }
  }, []);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(FLAG_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <Modal open={open} onClose={close} showClose={false} maxWidth={480}>
      <div style={{ padding: "40px 32px 32px", textAlign: "center" }}>
        {/* Moneda */}
        <div
          style={{
            width: 88,
            height: 88,
            margin: "0 auto 20px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--vertigo-gold)",
            background: "radial-gradient(circle at 35% 30%, rgba(212,175,55,0.25), rgba(212,175,55,0.04))",
            boxShadow: "0 0 40px rgba(212,175,55,0.25)",
          }}
        >
          <Coins style={{ width: 40, height: 40, color: "var(--vertigo-gold)" }} strokeWidth={1.5} />
        </div>

        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "var(--vertigo-purple-soft)",
            marginBottom: 10,
          }}
        >
          Bienvenido a las apuestas
        </div>

        <h2
          className="font-cinzel"
          style={{ fontSize: 26, fontWeight: 700, color: "var(--vertigo-text)", margin: "0 0 8px", lineHeight: 1.2 }}
        >
          Recibiste <span style={{ color: "var(--vertigo-gold)" }}>{points} puntos</span>
        </h2>

        <p style={{ fontSize: 13, color: "var(--vertigo-muted)", lineHeight: 1.6, margin: "0 0 24px" }}>
          Son tuyos para apostar en las llaves del torneo. Elegí qué equipo gana cada
          llave antes de que abra: si acertás, te llevás el pozo proporcional a tu apuesta.
        </p>

        {/* Reglas */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            textAlign: "left",
            padding: "16px 18px",
            borderRadius: 12,
            border: "1px solid var(--vertigo-line)",
            background: "rgba(19, 15, 27, 0.6)",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Swords style={{ width: 14, height: 14, color: "var(--vertigo-purple-soft)", marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--vertigo-muted)", lineHeight: 1.5 }}>
              Una apuesta por llave, monto libre hasta tu saldo. Podés cancelarla mientras la llave no abra.
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Trophy style={{ width: 14, height: 14, color: "var(--vertigo-gold)", marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--vertigo-muted)", lineHeight: 1.5 }}>
              Al final del torneo hay un premio para el espectador con más puntos.
            </span>
          </div>
        </div>

        <button
          onClick={close}
          className="vertigo-btn vertigo-btn-primary"
          style={{ width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 12 }}
        >
          <Coins style={{ width: 14, height: 14 }} />
          Empezar a apostar
        </button>

        <Link
          href="/bracket"
          onClick={close}
          style={{
            display: "inline-block",
            marginTop: 16,
            fontSize: 11,
            color: "var(--vertigo-faint)",
            textDecoration: "none",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Ver el bracket
        </Link>
      </div>
    </Modal>
  );
}
