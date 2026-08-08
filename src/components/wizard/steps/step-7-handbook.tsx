"use client";
import { useWizard } from "@/components/wizard/wizard-context";

export default function Step7Handbook() {
  const { data, updateData } = useWizard();
  const downloaded = data.handbookDownloadedAt !== null;

  function handleDownload() {
    updateData({ handbookDownloadedAt: new Date() });
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <div className="rules" style={{ marginBottom: "20px" }}>
        <h4>Contenido del handbook</h4>
        <p>I · Formato · Bo3/Bo5 · II · Mapas · III · Civilizaciones · IV · Conducta · V · Horarios · VI · Comodines · VII · Fairness · VIII · Casters</p>
      </div>
      <a href="https://tomlvgzwleolsxksiygs.supabase.co/storage/v1/object/public/handbook/vertigo-handbook.pdf" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        <button
          className={`btn ${downloaded ? "ghost" : "primary"}`}
          onClick={handleDownload}
          disabled={downloaded}
          style={{ cursor: downloaded ? "default" : "pointer" }}
        >
          {downloaded ? "✓ Handbook descargado" : "Descargar handbook PDF"}
          {!downloaded && <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>}
        </button>
      </a>
    </div>
  );
}
