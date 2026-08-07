export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="text-center max-w-md flex flex-col items-center gap-6">
        <div className="label-premium text-gold/80">INGRESAR</div>
        <h1 className="font-serif text-4xl">Iniciar sesión</h1>
        <p className="text-text-secondary text-sm font-light">
          Login para capitanes, admin y casters. Los equipos se registran desde /registro.
        </p>
        <p className="text-text-tertiary text-sm">(Módulo en desarrollo — Fase 1 MVP)</p>
      </div>
    </main>
  );
}
