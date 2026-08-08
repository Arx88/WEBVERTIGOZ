"use client";
import { useWizard } from "@/components/wizard/wizard-context";

export default function Step7Handbook() {
  const { data, updateData } = useWizard();
  const downloaded = data.handbookDownloadedAt !== null;

  function handleDownload() {
    // Marcar como descargado inmediatamente
    updateData({ handbookDownloadedAt: new Date() });
    // Abrir el PDF en una nueva pestaña SIN que el browser actual se vaya
    // Usar window.open con noopener para que no afecte el contexto
    try {
      window.open("https://tomlvgzwleolsxksiygs.supabase.co/storage/v1/object/public/handbook/vertigo-handbook.pdf", "_blank", "noopener,noreferrer");
    } catch (e) {
      // No importa si falla — lo importante es marcar como descargado
    }
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <div className="rules" style={{ marginBottom: "20px" }}>
        <h4>Contenido del handbook</h4>
        <p>I · Formato · Bo3/Bo5 · II · Mapas · III · Civilizaciones · IV · Conducta · V · Horarios · VI · Comodines · VII · Fairness · VIII · Casters</p>
      </div>
      <button
        className={`btn ${downloaded ? "ghost" : "primary"}`}
        onClick={handleDownload}
        disabled={downloaded}
      >
        {downloaded ? "✓ Handbook descargado" : "Descargar handbook PDF"}
        {!downloaded && <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>}
      </button>
    </div>
  );
}
