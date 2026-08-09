import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative w-full border-t border-[rgba(255,46,158,0.15)] bg-[#0a0011]">
      <div className="mx-auto max-w-6xl px-6 py-9 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/landing/logo.png" alt="Vertigo Cup" className="w-9 h-9 opacity-80" />
          <span className="font-cinzel text-[11px] tracking-[0.36em] uppercase text-[#ffb4dc]/70">
            Vértigo Cup · Age of Empires II
          </span>
        </Link>

        <span className="font-cinzel text-[10px] tracking-[0.42em] uppercase text-[#7a5a90]">
          Vértigo Cup 2026 &nbsp;·&nbsp; Derechos Reservados
        </span>
      </div>
    </footer>
  );
}
