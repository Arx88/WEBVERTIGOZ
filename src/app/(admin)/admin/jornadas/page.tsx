export default function AdminJornadasPage() {
  return (
    <div>
      <span className="vertigo-kicker">JORNADAS</span>
      <h1 className="vertigo-title">Configuración de jornadas</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">Asignar fecha y hora de inicio/fin a cada llave. Mover llaves entre jornadas. Sin partidas simultáneas (evento para stream).</p>
      <div className="vertigo-card">
        <div className="vertigo-empty">
          <div className="vertigo-empty-title">Módulo en desarrollo</div>
          <p className="vertigo-empty-desc">El scheduler de jornadas estará disponible cuando el bracket esté generado.</p>
        </div>
      </div>
    </div>
  );
}
