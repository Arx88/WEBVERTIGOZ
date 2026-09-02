import SiteNav from "@/components/nav/site-nav";
import VertigoFooter from "@/components/shared/vertigo-footer";
import NotificacionesList from "./notificaciones-list";

/**
 * /notificaciones — historial completo del usuario.
 * Server wrapper (SiteNav es server component); la lista es client.
 * Usa el shell del sitio (.vertigo-page/.vertigo-content) para integrarse
 * con el resto de las páginas (fixture, resultados, bracket).
 */
export const dynamic = "force-dynamic";

export default function NotificacionesPage() {
  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <SiteNav />
      <main className="vertigo-content" style={{ maxWidth: 920 }}>
        <NotificacionesList />
      </main>
      <VertigoFooter />
    </div>
  );
}
