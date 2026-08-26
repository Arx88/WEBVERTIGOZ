"use client";
import { useWizard } from "@/components/wizard/wizard-context";

// Fallback histórico (datos viejos con URL pública guardada en la edición).
const FALLBACK_HANDBOOK_URL = "https://tomlvgzwleolsxksiygs.supabase.co/storage/v1/object/public/handbook/vertigo-handbook.pdf";

export default function Step7Handbook() {
  const { data, updateData, config } = useWizard();
  const downloaded = data.handbookDownloadedAt !== null;
  const handbookUrl = config.handbookUrl ?? FALLBACK_HANDBOOK_URL;

  function handleDownload() {
    // Solo marcar como descargado. El usuario puede descargar el PDF
    // haciendo click en el link que aparece abajo.
    updateData({ handbookDownloadedAt: new Date() });
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
        {downloaded ? "✓ Handbook descargado" : "Marcar como descargado"}
        {!downloaded && <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>}
      </button>
      {downloaded && (
        <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--vertigo-muted)" }}>
          <a href={handbookUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--vertigo-purple-soft)" }}>
            Abrir handbook PDF →
          </a>
        </p>
      )}
    </div>
  );
}
