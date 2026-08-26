import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/wizard-referencia.css";

/**
 * Shell compartido de las páginas de autenticación (/login, /registro-caster,
 * /registro-espectador): video de fondo + una única tarjeta centrada.
 *
 * Reutiliza los estilos del wizard (wizard-referencia.css) anclándose a la
 * clase .wizard-page, pero relaja el lock de viewport para que el contenido
 * largo haga scroll de página en vez de recortarse.
 */
export default function AuthShell({
  closeHref = "/",
  kicker,
  title,
  description,
  children,
  footer,
}: {
  closeHref?: string;
  kicker: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="wizard-page auth-shell">
      <video className="wizard-bg-video" autoPlay muted loop playsInline>
        <source src="/landing/wizard-bg.mp4" type="video/mp4" />
      </video>
      <div className="wizard-bg-overlay" />

      <div className="modal auth-card">
        <Link href={closeHref} className="auth-close" aria-label="Cerrar">
          <svg viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>

        <section className="content auth-content">
          <div className="auth-logo">
            <img src="/landing/logo.png" alt="VÉRTIGO Cup" />
          </div>

          <div className="auth-header">
            <span className="p-kicker">{kicker}</span>
            <h2 className="p-title">{title}</h2>
            <div className="p-divider">
              <span></span>
              <i></i>
              <span></span>
            </div>
            {description ? <p className="p-desc">{description}</p> : null}
          </div>

          {children}

          {footer ? <div className="auth-footer">{footer}</div> : null}
        </section>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .link-hover { transition: color .3s; }
        .link-hover:hover { color: var(--purple-pale) !important; }

        /* El shell no bloquea el viewport: si la tarjeta es más alta que la
           pantalla, scrollea la página (el video queda fixed detrás). */
        .wizard-page.auth-shell {
          height: auto;
          min-height: 100vh;
          align-items: stretch;
          justify-content: center;
          overflow: visible;
          padding: 44px 16px;
        }
        html:has(.wizard-page.auth-shell),
        body:has(.wizard-page.auth-shell) {
          height: auto !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          background: #070310 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Tarjeta única centrada — margin:auto centra sin recortar arriba.
           z-index:2 es CRÍTICO: el overlay del video tiene z-index:1 y, al
           pintarse después que un posicionado con z-index auto, lo cubría
           con su velo oscuro (por eso la tarjeta se veía apagada). */
        .auth-shell .modal {
          width: min(480px, 100%);
          height: auto;
          max-height: none;
          margin: auto;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 2;
          background:
            linear-gradient(180deg, rgba(139, 92, 246, 0.30), rgba(124, 58, 237, 0.07) 45%),
            #1a1328;
          border-color: rgba(196, 181, 253, 0.44);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 30px 80px rgba(0, 0, 0, 0.55),
            0 0 90px rgba(124, 58, 237, 0.38),
            0 0 42px rgba(255, 46, 158, 0.16);
        }
        .auth-shell .content {
          padding: 42px 42px 32px;
          overflow: visible;
          display: block;
        }

        /* Blancos reales y contraste de lectura */
        .auth-shell .auth-header .p-title { color: #ffffff; text-shadow: 0 2px 18px rgba(124, 58, 237, 0.45); }
        .auth-shell .auth-header .p-kicker { color: #d8c7ff; }
        .auth-shell .auth-header .p-desc { color: #d5cde3; }
        .auth-shell .field label { color: #cdc4dc; }
        .auth-shell .field input {
          background: #241b3d;
          border-color: #4a3f66;
          color: #ffffff;
          transition: border-color .25s ease, background .25s ease, box-shadow .25s ease;
        }
        .auth-shell .field input::placeholder { color: #948aa9; }
        .auth-shell .field input:focus {
          border-color: #a78bfa;
          background: #2a2047;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.20);
        }
        .auth-shell .auth-close svg { stroke: #d5cee2; }

        /* Inputs con ícono a la izquierda (email, contraseña, nombre) */
        .wizard-page.auth-shell .input-wrap { position: relative; }
        .wizard-page.auth-shell .input-wrap .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #8f86a2;
          pointer-events: none;
          transition: color .25s ease;
        }
        .wizard-page.auth-shell .input-wrap:focus-within .input-icon { color: var(--purple-soft); }
        .wizard-page.auth-shell .input-wrap input { padding-left: 42px; }

        /* Entrada escalonada del contenido de la tarjeta */
        @keyframes authRise {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        .wizard-page.auth-shell .content > * { animation: authRise .55s var(--ease) backwards; }
        .wizard-page.auth-shell .content > :nth-child(1) { animation-delay: .05s; }
        .wizard-page.auth-shell .content > :nth-child(2) { animation-delay: .13s; }
        .wizard-page.auth-shell .content > :nth-child(3) { animation-delay: .21s; }
        .wizard-page.auth-shell .content > :nth-child(4) { animation-delay: .29s; }
        .wizard-page.auth-shell .content > :nth-child(5) { animation-delay: .37s; }

        /* Botón principal: brillo que barre + micro-elevación */
        .wizard-page.auth-shell .btn.primary {
          position: relative;
          overflow: hidden;
          transition: transform .25s var(--ease), box-shadow .25s var(--ease), opacity .25s;
        }
        .wizard-page.auth-shell .btn.primary::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0; left: -45%;
          width: 45%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.22), transparent);
          transform: skewX(-18deg) translateX(-160%);
          pointer-events: none;
        }
        .wizard-page.auth-shell .btn.primary:hover:not(:disabled)::after {
          transform: skewX(-18deg) translateX(500%);
          transition: transform .8s ease;
        }
        .wizard-page.auth-shell .btn.primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(124, 58, 237, 0.35), 0 4px 22px rgba(255, 46, 158, 0.16);
        }
        .wizard-page.auth-shell .btn.primary:active:not(:disabled) {
          transform: translateY(0) scale(.985);
        }

        /* Botón cerrar */
        .auth-close {
          position: absolute; top: 18px; right: 18px; z-index: 3;
          width: 38px; height: 38px; border-radius: 10px;
          border: 1px solid var(--input-border); background: transparent;
          cursor: pointer; display: grid; place-items: center;
          transition: all .35s var(--ease);
        }
        .auth-close svg {
          width: 14px; height: 14px; stroke: #b7b0c2; stroke-width: 2;
          stroke-linecap: round; fill: none; transition: all .35s var(--ease);
        }
        .auth-close:hover { border-color: #4a3f60; background: rgba(255,255,255,.03); }
        .auth-close:hover svg { stroke: #fff; }

        /* Encabezado estándar */
        .auth-logo { text-align: center; margin-bottom: 22px; }
        .auth-logo img {
          width: 76px; margin: 0 auto; display: block;
          filter: drop-shadow(0 0 16px rgba(196, 181, 253, 0.28));
        }
        .auth-header { text-align: center; margin-bottom: 26px; }
        .auth-header .p-kicker { display: block; text-align: center; margin-bottom: 10px; }
        .auth-header .p-title { font-size: 26px; text-align: center; }
        .auth-header .p-divider { margin: 16px auto 16px; max-width: 300px; }
        .auth-header .p-desc { text-align: center; font-size: 13px; max-width: 360px; margin: 0 auto; color: #b5adc4; }

        /* Fondo un poco más legible detrás de la tarjeta (scoped al shell) */
        .auth-shell .wizard-bg-overlay { opacity: 0.8; }

        .auth-footer {
          margin-top: 26px;
          padding-top: 20px;
          border-top: 1px solid var(--line-soft);
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: center;
        }
        .auth-footer-title {
          font-size: 13px;
          color: #cfc7dc;
          letter-spacing: .01em;
        }

        /* CTA principal del pie (ancho completo, tipo botón fantasma) */
        .auth-footer-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1px solid rgba(167, 139, 250, 0.40);
          background: rgba(124, 58, 237, 0.14);
          color: #ece5ff;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          text-decoration: none;
          cursor: pointer;
          transition: all .3s var(--ease);
        }
        .auth-footer-cta:hover {
          background: rgba(124, 58, 237, 0.26);
          border-color: #a78bfa;
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(124, 58, 237, 0.28);
        }

        /* Alternativas secundarias en grilla balanceada */
        .auth-alt {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .auth-chip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 12px;
          border-radius: 10px;
          border: 1px solid rgba(167, 139, 250, 0.22);
          background: rgba(124, 58, 237, 0.07);
          color: #cdc4dc;
          font-size: 12.5px;
          font-weight: 500;
          text-decoration: none;
          transition: all .3s var(--ease);
        }
        .auth-chip svg { color: #a78bfa; transition: color .3s ease; flex: none; }
        .auth-chip:hover {
          border-color: rgba(255, 46, 158, 0.45);
          background: rgba(255, 46, 158, 0.09);
          color: #ffffff;
        }
        .auth-chip:hover svg { color: #ff2e9e; }
        @media (max-width: 420px) { .auth-alt { grid-template-columns: 1fr; } }

        @media (prefers-reduced-motion: reduce) {
          .wizard-page.auth-shell .content > *,
          .wizard-page.auth-shell .modal { animation: none !important; }
        }

        @media (max-width: 520px) {
          .wizard-page.auth-shell { padding: 24px 12px; }
          .auth-shell .content { padding: 34px 22px 24px; }
        }
      `}</style>
    </div>
  );
}
