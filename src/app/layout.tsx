import type { Metadata } from "next";
import { Oswald, Cinzel, Anton, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
  weight: ["200", "300", "400", "500", "600", "700"],
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const anton = Anton({
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
  weight: "400",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "VÉRTIGO Cup — Age of Empires II Tournament",
    template: "%s — VÉRTIGO Cup",
  },
  description:
    "Plataforma del torneo VÉRTIGO de Age of Empires II. 32 equipos, 3 jugadores cada uno, partidas sorteadas con ruleta 15 minutos antes.",
  keywords: ["Age of Empires II", "AoE2", "tournament", "torneo", "VERTIGO", "esports"],
  authors: [{ name: "VERTIGO Cup Staff" }],
  manifest: "/manifest.json",
  openGraph: {
    title: "VÉRTIGO Cup — Age of Empires II Tournament",
    description: "El azar decide tu destino. 32 equipos. 15 minutos. Una ruleta.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${oswald.variable} ${cinzel.variable} ${anton.variable} ${inter.variable} dark`}
    >
      <body className="bg-bg text-text antialiased min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
