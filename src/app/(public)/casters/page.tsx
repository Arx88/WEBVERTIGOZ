export default function CastersPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="text-center max-w-md flex flex-col items-center gap-6">
        <div className="label-premium text-gold/80">CASTERS</div>
        <h1 className="font-serif text-4xl">Casters del torneo</h1>
        <p className="text-text-secondary text-sm font-light">Lista de casters oficiales y community.</p>
        <p className="text-text-tertiary text-sm">(Visible cuando abra la inscripción)</p>
      </div>
    </main>
  );
}
