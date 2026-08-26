import AuthBadge from "@/components/auth/auth-badge";

/**
 * Layout del grupo (captain): monta el chip de usuario (menú según rol,
 * con cerrar sesión) arriba a la derecha, igual que en las páginas públicas.
 * Así el header de capitán no necesita su propio botón "Salir".
 */
export default function CaptainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthBadge />
      {children}
    </>
  );
}
