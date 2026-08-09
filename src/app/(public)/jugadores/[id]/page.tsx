export default function JugadorPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="text-center max-w-md flex flex-col items-center gap-6">
        <div className="label-premium text-gold/80">JUGADOR</div>
        <h1 className="font-serif text-4xl">Perfil del jugador</h1>
        <p className="text-text-secondary text-sm font-light">Stats AoE2 Companion + historial en VÉRTIGO.</p>
        <p className="text-text-tertiary text-sm">(Visible cuando abra la inscripción)</p>
      </div>
    </main>
  );
}
