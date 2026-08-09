"use client";
import { useWizard } from "@/components/wizard/wizard-context";

export default function Step8Terms() {
  const { data, updateData } = useWizard();
  return (
    <>
      <div className="rules">
        <h4>I · Formato</h4>
        <p>Los enfrentamientos serán al mejor de 3 partidas (Bo3). La gran final se disputará al mejor de 5 (Bo5).</p>
        <h4>II · Mapas</h4>
        <p>El mapa decisivo se elegirá por sorteo entre las preferencias declaradas por ambos equipos.</p>
        <h4>III · Civilizaciones</h4>
        <p>Cada jugador podrá utilizar únicamente una de las civilizaciones declaradas en su inscripción.</p>
        <h4>IV · Conducta</h4>
        <p>El uso de cheats, bugs abusivos o lenguaje tóxico supone la descalificación inmediata del equipo.</p>
        <h4>V · Horarios</h4>
        <p>Tolerancia de 10 minutos sobre la hora oficial. Pasado ese tiempo, derrota por walkover.</p>
        <h4>VI · Transmisión</h4>
        <p>Las partidas pueden ser transmitidas en vivo por los canales oficiales (Twitch, YouTube, Kick) y casters community.</p>
      </div>
      <div className="checks">
        <label className="check-row">
          <input type="checkbox" checked={data.restreamAccepted} onChange={(e) => updateData({ restreamAccepted: e.target.checked })} />
          <span className="box"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg></span>
          <span className="txt">Acepto el permiso de transmisión de mis partidas en los canales oficiales.</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={data.termsAcceptedAt !== null} onChange={(e) => updateData({ termsAcceptedAt: e.target.checked ? new Date() : null })} />
          <span className="box"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg></span>
          <span className="txt">He leído y acepto el reglamento oficial de la Vertigo Cup.</span>
        </label>
      </div>
    </>
  );
}
