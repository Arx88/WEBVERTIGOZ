import StreamConvergenceBackground from "@/components/shared/stream-convergence-background";
import LoaderPhrase from "@/components/shared/loader-phrase";

/**
 * PageLoader — estado de carga entre navegaciones (loading.tsx).
 * Server-compatible: sin hooks, el logo + barrita fucsia + fondo
 * StreamConvergence (WebGL, componente cliente).
 *
 * Las frases rotan en ciclo completo (todas antes de repetirse).
 */
export default function PageLoader() {
  return (
    <div className="vertigo-loader" role="status" aria-live="polite">
      <StreamConvergenceBackground />
      <div className="vertigo-loader-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-vertigo.webp"
          alt="VÉRTIGO CUP"
          className="vertigo-loader-logo"
        />
        <div className="vertigo-loader-bar" />
        <LoaderPhrase />
      </div>
    </div>
  );
}