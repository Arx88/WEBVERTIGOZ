import AuthBadge from "@/components/auth/auth-badge";

/**
 * Layout del grupo (public): monta la píldora de sesión fija
 * arriba a la derecha en todas las páginas públicas.
 */
export default function PublicLayout({
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
