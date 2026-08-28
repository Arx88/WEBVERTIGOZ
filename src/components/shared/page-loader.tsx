/**
 * PageLoader — estado de carga entre navegaciones (loading.tsx).
 * Server-compatible: sin hooks, solo el anillo dorado del design system.
 */
export default function PageLoader({
  label = "Cargando…",
}: {
  label?: string;
}) {
  return (
    <div className="vertigo-loader" role="status" aria-live="polite">
      <div className="vertigo-loader-ring" />
      <div className="vertigo-loader-label">{label}</div>
    </div>
  );
}
