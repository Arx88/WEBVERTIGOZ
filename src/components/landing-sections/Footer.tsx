"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Youtube, Download, FileText, Loader2 } from "lucide-react";
import { DISCORD_INVITE_URL, YOUTUBE_CHANNEL_URL } from "@/lib/constants";
import { DiscordIcon, PayPalIcon, MercadoPagoIcon } from "@/components/shared/brand-icons";

const NAV_LINKS = [
  { href: "/bracket", label: "Bracket" },
  { href: "/fixture", label: "Fixture" },
  { href: "/resultados", label: "Resultados" },
  { href: "/casters", label: "Casters" },
];

export default function Footer() {
  const [handbookUrl, setHandbookUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // La URL firmada del handbook la genera el server (el bucket es privado);
  // mismo mecanismo que la sección de reglas de la landing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tournament/config");
        if (!res.ok) return;
        const c = await res.json();
        if (!cancelled && c.found && c.handbookUrl) setHandbookUrl(c.handbookUrl);
      } catch {
        // Sin handbook subido todavía
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openHandbook = () => {
    if (loading) return;
    setLoading(true);
    try {
      if (handbookUrl) window.open(handbookUrl, "_blank", "noopener,noreferrer");
      else window.location.href = "/admin/handbook";
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="relative w-full border-t border-[rgba(255,46,158,0.15)] bg-[#0a0011]">
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.5fr_0.75fr_1fr_1.1fr]">
          {/* ─── Marca + redes ─── */}
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/logo.png" alt="Vértigo Cup" className="w-12 h-12 opacity-90" />
              <div>
                <div className="font-cinzel text-[15px] font-bold tracking-[0.22em] uppercase text-[#f2eef7]">
                  Vértigo Cup
                </div>
                <div className="font-cinzel text-[9px] tracking-[0.38em] uppercase text-[#ffb4dc]/60 mt-1">
                  Age of Empires II
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-xs text-[12.5px] leading-relaxed text-[#e6d3f5]/60">
              El torneo donde cada giro de la ruleta puede cambiar la historia de tu reino.
            </p>

            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-md border border-[#ff2e9e]/30 bg-[rgba(255,46,158,0.04)] px-4 py-2.5 transition-all duration-300 hover:border-[#ff2e9e]/70 hover:bg-[#ff2e9e]/10 hover:shadow-[0_0_18px_rgba(255,46,158,0.25)]"
              >
                <Youtube className="w-4 h-4 text-[#ff5d5d]" />
                <span className="font-cinzel text-[10px] font-bold tracking-[0.28em] uppercase text-[#ffb4dc]">
                  YouTube
                </span>
              </a>
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-md border border-[#ff2e9e]/30 bg-[rgba(255,46,158,0.04)] px-4 py-2.5 transition-all duration-300 hover:border-[#ff2e9e]/70 hover:bg-[#ff2e9e]/10 hover:shadow-[0_0_18px_rgba(255,46,158,0.25)]"
              >
                <DiscordIcon className="w-4 h-4" style={{ color: "#5865F2" }} />
                <span className="font-cinzel text-[10px] font-bold tracking-[0.28em] uppercase text-[#ffb4dc]">
                  Discord
                </span>
              </a>
            </div>
          </div>

          {/* ─── Torneo ─── */}
          <div>
            <div className="font-cinzel text-[10px] font-bold tracking-[0.42em] uppercase text-[#ffb4dc]/60 mb-5">
              Torneo
            </div>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-[#e6d3f5]/70 transition-colors hover:text-[#ffb4dc]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ─── Recursos ─── */}
          <div>
            <div className="font-cinzel text-[10px] font-bold tracking-[0.42em] uppercase text-[#ffb4dc]/60 mb-5">
              Recursos
            </div>
            <div className="flex flex-col gap-3 items-start">
              <button
                onClick={openHandbook}
                disabled={loading}
                className="flex items-center gap-2.5 rounded-md border border-[#ff2e9e]/40 bg-[rgba(255,46,158,0.06)] px-4 py-2.5 transition-all duration-300 hover:border-[#ff2e9e]/80 hover:bg-[#ff2e9e]/12 hover:shadow-[0_0_18px_rgba(255,46,158,0.3)] disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 text-[#ffb4dc] animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-[#ffb4dc]" />
                )}
                <span className="font-cinzel text-[10px] font-bold tracking-[0.28em] uppercase text-[#ffb4dc]">
                  Descargar Handbook
                </span>
              </button>
              <Link
                href="/terminos"
                className="flex items-center gap-2.5 px-1 text-[13px] text-[#e6d3f5]/70 transition-colors hover:text-[#ffb4dc]"
              >
                <FileText className="w-3.5 h-3.5 opacity-70" />
                Términos y Condiciones
              </Link>
            </div>
          </div>

          {/* ─── Formas de pago ─── */}
          <div>
            <div className="font-cinzel text-[10px] font-bold tracking-[0.42em] uppercase text-[#ffb4dc]/60 mb-5">
              Formas de pago
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-2.5 rounded-md border border-[rgba(255,46,158,0.25)] bg-[rgba(255,255,255,0.05)] px-4 h-10">
                <PayPalIcon className="w-4 h-4 text-white" />
                <span className="text-[12px] font-extrabold italic text-white/90">
                  PayPal
                </span>
              </span>
              <span className="flex items-center gap-2.5 rounded-md border border-[rgba(255,46,158,0.25)] bg-[rgba(255,255,255,0.05)] px-4 h-10">
                <MercadoPagoIcon className="w-6 h-6 text-white" />
                <span className="text-[12px] font-extrabold text-white/90">
                  Mercado Pago
                </span>
              </span>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-[#e6d3f5]/45">
              Pagá solo por los canales oficiales comunicados por el staff.
            </p>
          </div>
        </div>

        {/* ─── Barra inferior ─── */}
        <div
          className="mt-14 pt-6 border-t border-[rgba(255,46,158,0.12)] flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          <span className="font-cinzel text-[10px] tracking-[0.42em] uppercase text-[#7a5a90]">
            Vértigo Cup 2026 &nbsp;·&nbsp; Derechos Reservados
          </span>
          <span className="text-[10px] tracking-[1px] text-[#7a5a90]">
            Los puntos son de juego — no tienen valor monetario.
          </span>
        </div>
      </div>
    </footer>
  );
}
