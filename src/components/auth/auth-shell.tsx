import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/wizard-referencia.css";

/**
 * Shell compartido de las páginas de autenticación (/login, /registro-caster,
 * /registro-espectador): video de fondo a página completa + una tarjeta
 * dividida en DOS zonas con un eje cada una:
 *
 *   · auth-brand (izquierda): panel de marca con video animado de fondo,
 *     logo grande, kicker, título y descripción — todo CENTRADO.
 *   · auth-main (derecha): el flujo real (acceso rápido, form, CTAs).
 *
 * El botón de cerrar vive EN FLUJO en la fila superior del panel del form
 * (etiqueta a la izquierda, X a la derecha): nunca flota sobre el
 * contenido. La tarjeta nunca genera scroll de página: si el contenido
 * crece, scrollea DENTRO del panel del formulario.
 */
export default function AuthShell({
  closeHref = "/",
  kicker,
  title,
  description,
  mainLabel,
  children,
  footer,
}: {
  closeHref?: string;
  kicker: string;
  title: string;
  description?: ReactNode;
  /** Etiqueta de la fila superior del panel del form (p.ej. "Acceso rápido"). */
  mainLabel?: string;
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
        <section className="content auth-content">
          <aside className="auth-brand">
            <video
              className="auth-brand-video"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/landing/auth-brand-poster.jpg"
            >
              <source src="/landing/auth-brand-loop.mp4" type="video/mp4" />
            </video>
            <div className="auth-brand-veil" aria-hidden="true" />
            <div className="auth-brand-inner">
              <div className="auth-logo">
                <img src="/landing/logo.png" alt="VÉRTIGO Cup" />
              </div>
              <span className="p-kicker">{kicker}</span>
              <h2 className="p-title">{title}</h2>
              <div className="p-divider">
                <span></span>
                <i></i>
                <span></span>
              </div>
              {description ? <p className="p-desc">{description}</p> : null}
            </div>
          </aside>

          <div className="auth-main">
            <div className="auth-main-head">
              {mainLabel ? (
                <span className="auth-main-eyebrow">{mainLabel}</span>
              ) : (
                <span aria-hidden="true" />
              )}
              <Link href={closeHref} className="auth-close" aria-label="Cerrar">
                <svg viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </Link>
            </div>

            {children}
            {footer ? <div className="auth-footer">{footer}</div> : null}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes authRise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes brandIn {
          from { opacity: 0; transform: scale(1.035); }
          to   { opacity: 1; transform: none; }
        }
        .link-hover { transition: color .3s; }
        .link-hover:hover { color: var(--purple-pale) !important; }

        /* El shell llena la ventana exacta: el modal NUNCA genera scroll de
           página. Si el contenido crece, scrollea DENTRO de la tarjeta. */
        .wizard-page.auth-shell {
          height: 100vh;
          min-height: 100vh;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 16px;
        }
        html:has(.wizard-page.auth-shell),
        body:has(.wizard-page.auth-shell) {
          overflow: hidden !important;
          background: #070310 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Fondo a página completa. z-index:2 en la tarjeta es CRÍTICO: el
           overlay del video (z:1) la cubriría con su velo si no. */
        .wizard-page.auth-shell .wizard-bg-video { opacity: 1; }
        .auth-shell .wizard-bg-overlay { opacity: 0.55; }

        .auth-shell .modal {
          width: min(920px, 100%);
          height: auto;
          max-height: calc(100vh - 32px);
          margin: auto;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 2;
          overflow: hidden;
          background: #0f0b18;
          border-color: rgba(167, 139, 250, 0.30);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.10),
            0 40px 110px rgba(0, 0, 0, 0.62),
            0 0 90px rgba(124, 58, 237, 0.30);
        }
        .auth-shell .auth-content {
          display: flex;
          flex-direction: row;
          flex: 1;
          min-height: 0;
          padding: 0;
          overflow: hidden;
        }

        /* --- Zona de marca (izquierda): video animado + todo centrado --- */
        .auth-shell .auth-brand {
          position: relative;
          flex: 0 0 42%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          background: #0a0714;
          border-right: 1px solid rgba(167, 139, 250, 0.22);
          animation: brandIn .8s var(--ease) both;
        }
        .auth-shell .auth-brand-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          pointer-events: none;
        }
        .auth-shell .auth-brand-veil {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            130% 100% at 50% 40%,
            rgba(7, 3, 16, 0.55) 0%,
            rgba(7, 3, 16, 0.16) 52%,
            rgba(7, 3, 16, 0.62) 100%
          );
        }
        .auth-shell .auth-brand-inner {
          position: relative;
          z-index: 1;
          padding: 34px 30px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .auth-shell .auth-logo img {
          width: 123px;
          display: block;
          margin: 0 auto;
          filter: drop-shadow(0 10px 36px rgba(124, 58, 237, 0.48));
        }
        .auth-shell .auth-brand-inner .p-kicker {
          display: block;
          margin: 22px 0 9px;
          color: #d8c7ff;
          text-align: center;
        }
        .auth-shell .auth-brand-inner .p-title {
          font-size: 28px;
          text-align: center;
          color: #ffffff;
          text-shadow: 0 2px 24px rgba(124, 58, 237, 0.55);
        }
        .auth-shell .auth-brand-inner .p-divider { margin: 18px auto; max-width: 210px; }
        .auth-shell .auth-brand-inner .p-desc {
          text-align: center;
          font-size: 13px;
          line-height: 1.65;
          max-width: 280px;
          margin: 0;
          color: #d3cce2;
        }

        /* --- Zona del formulario (derecha): fondo sólido, un solo eje --- */
        .auth-shell .auth-main {
          flex: 1;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 26px 46px 22px;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .auth-shell .auth-main::-webkit-scrollbar { width: 6px; }
        .auth-shell .auth-main::-webkit-scrollbar-track { background: transparent; }
        .auth-shell .auth-main::-webkit-scrollbar-thumb {
          background: rgba(124, 58, 237, 0.35);
          border-radius: 999px;
        }

        /* Fila superior del panel: etiqueta a la izquierda, cerrar a la
           derecha. La X vive EN FLUJO — nunca flota sobre el contenido. */
        .auth-shell .auth-main-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 38px;
          margin: 0 0 14px;
        }
        .auth-shell .auth-main-eyebrow {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #b9a8e8;
        }
        .auth-close {
          flex: none;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(196, 181, 253, 0.28);
          background: rgba(10, 6, 18, 0.62);
          backdrop-filter: blur(4px);
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: all .35s var(--ease);
        }
        .auth-close svg {
          width: 14px; height: 14px; stroke: #d5cee2; stroke-width: 2;
          stroke-linecap: round; fill: none; transition: all .35s var(--ease);
        }
        .auth-close:hover { border-color: #a78bfa; background: rgba(30, 18, 52, 0.85); }
        .auth-close:hover svg { stroke: #fff; }

        /* En pantallas touch (sin hover) la X de olvidar cuenta vive
           siempre visible — no hay hover para revelarla. */
        @media (hover: none) {
          .auth-shell .qa-forget { opacity: 1; }
        }

        /* Entrada escalonada del contenido de la tarjeta */
        .wizard-page.auth-shell .auth-main > * { animation: authRise .55s var(--ease) backwards; }
        .wizard-page.auth-shell .auth-main > :nth-child(1) { animation-delay: .08s; }
        .wizard-page.auth-shell .auth-main > :nth-child(2) { animation-delay: .16s; }
        .wizard-page.auth-shell .auth-main > :nth-child(3) { animation-delay: .24s; }
        .wizard-page.auth-shell .auth-main > :nth-child(4) { animation-delay: .32s; }

        /* Blancos reales y contraste de lectura en el form */
        .auth-shell .field label { color: #cdc4dc; }
        .auth-shell .field input {
          height: 46px;
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

        .auth-footer {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid rgba(167, 139, 250, 0.16);
          display: flex;
          flex-direction: column;
          gap: 9px;
          text-align: center;
        }
        .auth-footer-title {
          font-size: 12.5px;
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
          padding: 11px 16px;
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
          padding: 9px 12px;
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

        /* Mobile/tablet (<900px): columna — la marca como header compacto */
        @media (max-width: 899px) {
          .wizard-page.auth-shell { padding: 16px 12px; }
          .auth-shell .modal {
            width: min(460px, 100%);
            max-height: calc(100vh - 32px);
          }
          .auth-shell .auth-content { flex-direction: column; }
          .auth-shell .auth-brand {
            flex: none;
            border-right: none;
            border-bottom: 1px solid rgba(167, 139, 250, 0.22);
          }
          .auth-shell .auth-brand-inner { padding: 22px 20px 20px; }
          .auth-shell .auth-logo img { width: 74px; }
          .auth-shell .auth-brand-inner .p-kicker { margin: 13px 0 6px; font-size: 10.5px; }
          .auth-shell .auth-brand-inner .p-title { font-size: 21px; }
          .auth-shell .auth-brand-inner .p-divider { margin: 12px auto; }
          .auth-shell .auth-brand-inner .p-desc { font-size: 12px; max-width: 330px; }
          .auth-shell .auth-main {
            justify-content: flex-start;
            padding: 20px 22px 18px;
          }
          /* En mobile el form entra denso: menos aire entre cuentas y campos */
          .auth-shell .auth-main .btn.primary { padding: 12px 30px; }
          .auth-shell .auth-footer-cta { padding: 10px 14px; }
          .auth-shell .auth-chip { padding: 8px 10px; }
        }

        @media (max-width: 520px) {
          .wizard-page.auth-shell { padding: 12px 8px; }
          .auth-shell .modal { max-height: calc(100vh - 24px); }
          .auth-shell .auth-main { padding: 22px 18px 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .wizard-page.auth-shell .auth-main > *,
          .wizard-page.auth-shell .auth-brand,
          .wizard-page.auth-shell .modal { animation: none !important; }
        }
      `}</style>

      {/* Fallback de autoplay: si el navegador bloqueó el autoplay (ahorro de
          batería, política empresarial, etc.), reintentamos en la primera
          interacción del usuario para que el fondo y el panel se animen igual. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var vs=document.querySelectorAll('video.wizard-bg-video, video.auth-brand-video');if(!vs.length)return;var t=function(){for(var i=0;i<vs.length;i++){var v=vs[i];if(v.paused){var p=v.play();if(p&&p.catch)p.catch(function(){})}}};['pointerdown','keydown','touchstart','wheel'].forEach(function(e){window.addEventListener(e,t,{passive:true})});for(var i=0;i<vs.length;i++){vs[i].addEventListener('loadeddata',t)}})();`,
        }}
      />
    </div>
  );
}
