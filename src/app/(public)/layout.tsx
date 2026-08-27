/**
 * Layout del grupo (public): las páginas internas montan su propio
 * SiteNav con el chip de sesión integrado; el landing monta AuthBadge fijo.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
