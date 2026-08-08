export default function AdminHandbookPage() {
  return (
    <div>
      <span className="vertigo-kicker">HANDBOOK</span>
      <h1 className="vertigo-title">Subir PDF del reglamento</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">Subí el PDF con el reglamento completo del torneo. Los equipos deberán descargarlo obligatoriamente antes de poder aceptar los términos y completar la inscripción.</p>
      <div className="vertigo-card">
        <div className="vertigo-empty">
          <div className="vertigo-empty-title">Handbook actual</div>
          <p className="vertigo-empty-desc" style={{ marginBottom: "16px" }}>Ya hay un handbook subido. Para reemplazarlo, subí un nuevo PDF.</p>
          <a href="https://tomlvgzwleolsxksiygs.supabase.co/storage/v1/object/public/handbook/vertigo-handbook.pdf" target="_blank" rel="noopener noreferrer">
            <button className="vertigo-btn vertigo-btn-ghost">Ver handbook actual →</button>
          </a>
        </div>
      </div>
    </div>
  );
}
