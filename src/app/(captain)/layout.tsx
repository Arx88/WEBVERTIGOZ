/**
 * Layout del grupo (captain): cada página monta SiteNav, que incluye
 * el chip de usuario con menú según rol y cerrar sesión.
 */
export default function CaptainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
