import SiteNav from "@/components/nav/site-nav";
import VertigoFooter from "@/components/shared/vertigo-footer";
import NotificacionesList from "./notificaciones-list";

/**
 * /notificaciones — historial completo del usuario.
 * Server wrapper (SiteNav es server component); la lista es client.
 */
export const dynamic = "force-dynamic";

export default function NotificacionesPage() {
  return (
    <>
      <SiteNav />
      <main className="notif-page">
        <NotificacionesList />
      </main>
      <VertigoFooter />
    </>
  );
}
