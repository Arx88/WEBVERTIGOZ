export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border border-gold/60 rotate-45 flex items-center justify-center">
              <span className="-rotate-45 font-serif text-gold text-sm font-bold">V</span>
            </div>
            <span className="font-serif text-xl">VÉRTIGO · Admin</span>
          </div>
          <nav className="flex items-center gap-6 text-label text-text-secondary">
            <a href="/admin/torneo" className="hover:text-text-primary">Torneo</a>
            <a href="/admin/equipos" className="hover:text-text-primary">Equipos</a>
            <a href="/admin/bracket" className="hover:text-text-primary">Bracket</a>
            <a href="/admin/casters" className="hover:text-text-primary">Casters</a>
            <a href="/admin/emblemas" className="hover:text-text-primary">Emblemas</a>
            <a href="/admin/handbook" className="hover:text-text-primary">Handbook</a>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-7xl w-full px-6 py-8">
        {children}
      </main>
    </div>
  );
}
