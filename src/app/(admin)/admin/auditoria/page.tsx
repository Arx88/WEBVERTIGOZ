export default function AdminAuditoriaPage() {
  return (
    <div>
      <span className="vertigo-kicker">AUDITORÍA</span>
      <h1 className="vertigo-title">Logs inmutables</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">Verificación criptográfica de cada sorteo. Hash commit-reveal SHA-256. Log append-only con hash encadenado.</p>
      <div className="vertigo-card">
        <div className="vertigo-empty">
          <div className="vertigo-empty-title">Módulo en desarrollo</div>
          <p className="vertigo-empty-desc">El sistema de auditoría de sorteos estará disponible en la Fase 2 (V1).</p>
        </div>
      </div>
    </div>
  );
}
