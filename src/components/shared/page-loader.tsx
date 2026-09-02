import StreamConvergenceBackground from "@/components/shared/stream-convergence-background";
import LoaderPhrase from "@/components/shared/loader-phrase";

/**
 * PageLoader — estado de carga entre navegaciones (loading.tsx).
 * Server-compatible: sin hooks, el logo + barrita fucsia + fondo
 * StreamConvergence (WebGL, componente cliente).
 *
 * Las frases rotan en ciclo completo (todas antes de repetirse).
 *
 * /loader-boot.js (público, generado desde stream-convergence-bootstrap.ts)
 * arranca el WebGL ANTES de que React hidrate: el HTML del loading se pinta
 * apenas llega la respuesta (en dev, mientras el bundle cliente compila,
 * esa ventana dura segundos) y sin esto solo se veía el gradiente CSS
 * plano ("fondo sólido"). El script dibuja sobre el MISMO canvas que
 * React hidrata y expone host.__vertigoBoot; el componente cliente lo
 * adopta cuando su efecto corre.
 *
 * NOTA: un <script> con dangerouslySetInnerHTML NO viaja en el HTML de un
 * boundary de Suspense (React 19 lo dropea del stream) — por eso es un
 * archivo estático referenciado con src, que sí se emite.
 */
export default function PageLoader() {
  return (
    <div className="vertigo-loader" role="status" aria-live="polite">
      <StreamConvergenceBackground />
      {/* Bootstrap pre-hidratación del fondo WebGL. async=false (default):
          bloquea y ejecuta en orden, garantizando que corra antes del
          primer paint del canvas. */}
      <script src="/loader-boot.js" />
      <div className="vertigo-loader-inner">
        <div className="vertigo-loader-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-vertigo.webp"
            alt="VÉRTIGO CUP"
            className="vertigo-loader-logo"
          />
          <div className="vertigo-loader-text">
            <div className="vertigo-loader-bar" />
            <LoaderPhrase />
          </div>
        </div>
      </div>
    </div>
  );
}
