import Link from "next/link";
import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import MatchRealtimeWrapper, { loadMatch } from "./match-realtime-wrapper";

export const dynamic = "force-dynamic";

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let initialMatch = null;
  try {
    const supabase = await getSupabaseServer();
    initialMatch = await loadMatch(supabase, id);
  } catch {
    initialMatch = null;
  }

  if (!initialMatch) {
    // Si no encontramos el match, mostramos un estado "no encontrado" con el diseño.
    return (
      <div className="vertigo-page vertigo-shell vertigo-fade-in">
        <header className="vertigo-header">
          <div className="vertigo-header-left">
            <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
            <span className="vertigo-section-tag">PARTIDO</span>
          </div>
          <div className="vertigo-header-right">
            <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
              ← Resultados
            </Link>
          </div>
        </header>
        <main className="vertigo-content">
          <span className="vertigo-kicker">PARTIDO</span>
          <h1 className="vertigo-title">Detalle del partido</h1>
          <div className="vertigo-divider"><span></span><i></i><span></span></div>
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Swords
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Partido no encontrado</div>
              <p className="vertigo-empty-desc">
                El partido puede haber sido cancelado, no existe, o todavía no fue generado por
                el bracket.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">PARTIDO</span>
        </div>
        <div className="vertigo-header-right">
          <Link href="/bracket" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Bracket
          </Link>
          <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Resultados
          </Link>
        </div>
      </header>

      <main className="vertigo-content">
        <span className="vertigo-kicker">PARTIDO</span>
        <h1 className="vertigo-title">Detalle del partido</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Score, resultado del sorteo, civilizaciones, comodines usados y stream en vivo. Todo
          se actualiza en tiempo real cuando el staff ejecuta acciones.
        </p>

        <MatchRealtimeWrapper matchId={id} initialMatch={initialMatch} />
      </main>
    </div>
  );
}
