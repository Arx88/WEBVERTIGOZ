export default function PartidoPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="text-center max-w-md flex flex-col items-center gap-6">
        <div className="label-premium text-gold/80">PARTIDO</div>
        <h1 className="font-serif text-4xl">Detalle del partido</h1>
        <p className="text-text-secondary text-sm font-light">Equipos, sorteo, resultado, stream.</p>
        <p className="text-text-tertiary text-sm">(Visible cuando esté el bracket generado)</p>
      </div>
    </main>
  );
}
