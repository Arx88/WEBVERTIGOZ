import Link from "next/link";

export const metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <div className="vertigo-state-screen">
      <div>
        <div className="vertigo-state-code">404</div>
        <h1 className="vertigo-state-title">Territorio inexplorado</h1>
        <p className="vertigo-state-desc">
          Los exploradores no encuentran nada por acá. La página que buscás no
          existe o fue movida durante la campaña.
        </p>
        <div className="vertigo-state-actions">
          <Link href="/" className="vertigo-state-btn vertigo-state-btn--solid">
            Volver al inicio
          </Link>
          <Link href="/bracket" className="vertigo-state-btn vertigo-state-btn--ghost">
            Ver el bracket
          </Link>
        </div>
      </div>
    </div>
  );
}
