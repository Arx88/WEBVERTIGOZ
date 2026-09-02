/**
 * Layout del grupo (auth): las páginas montan su propio .wizard-page
 * (100vw/100vh, video fixed) — no necesitan wrapper. Importante NO
 * envolver en un flex en fila: el PageLoader del loading.tsx de este
 * grupo se renderiza dentro del layout, y como ítem flex colapsaría
 * al ancho de su contenido en vez de pantalla completa.
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
