"use client";

/**
 * Error boundary del root — captura errores de runtime de cualquier página
 * y muestra una pantalla con marca en lugar del default blanco de Next.
 * "Reintentar" re-renderiza el segmento afectado sin recargar la app.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="vertigo-state-screen">
      <div>
        <div className="vertigo-state-code">⚠</div>
        <h1 className="vertigo-state-title">Algo se quebró en el asedio</h1>
        <p className="vertigo-state-desc">
          Ocurrió un error inesperado. Podés reintentar — si el problema
          persiste, avisá al staff con el código{" "}
          <code style={{ color: "var(--vertigo-purple-soft)" }}>
            {error.digest ?? "sin digest"}
          </code>
          .
        </p>
        <div className="vertigo-state-actions">
          <button
            type="button"
            onClick={reset}
            className="vertigo-state-btn vertigo-state-btn--solid"
          >
            Reintentar
          </button>
          <a href="/" className="vertigo-state-btn vertigo-state-btn--ghost">
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
