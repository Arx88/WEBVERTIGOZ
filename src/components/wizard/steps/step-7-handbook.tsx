"use client";
import { useState } from "react";
import { useWizard } from "@/components/wizard/wizard-context";

export default function Step7Handbook() {
  const { data, updateData } = useWizard();
  const downloaded = data.handbookDownloadedAt !== null;
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    // Abrir en nueva pestaña pero SIN que el browser se vaya
    try {
      // Usar un link temporal con target _blank
      const link = document.createElement("a");
      link.href = "https://tomlvgzwleolsxksiygs.supabase.co/storage/v1/object/public/handbook/vertigo-handbook.pdf";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      // Si falla, no importa — el punto es que el usuario lo descargue
    }
    // Marcar como descargado inmediatamente
    updateData({ handbookDownloadedAt: new Date() });
    setDownloading(false);
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
        disabled={downloaded || downloading}
      >
        {downloading ? "Descargando..." : downloaded ? "✓ Handbook descargado" : "Descargar handbook PDF"}
        {!downloaded && !downloading && <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>}
      </button>
    </div>
  );
}
