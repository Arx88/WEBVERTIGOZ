import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fondo — casi negro, premium sobrio
        bg: {
          DEFAULT: "#08080A",       // fondo principal del sitio
          elevated: "#0C0C0F",       // cards, paneles, modales
          hover: "#14141A",          // estados hover sutiles
          deep: "#040406",           // footer, áreas profundas
        },
        // Bordes
        border: {
          DEFAULT: "#1F1F26",        // bordes 1px sutiles
          strong: "#2A2A33",         // bordes más visibles
          gold: "#D4AF37",           // ornamentos, headers premium
        },
        // Texto
        text: {
          DEFAULT: "#FFF8E7",        // blanco roto (no puro)
          primary: "#FFF8E7",
          secondary: "#A0A0A8",      // gris claro para metadata
          tertiary: "#5C5C66",       // gris para placeholders
          muted: "#7A7A82",           // gris para texto auxiliar
        },
        // Acentos
        accent: {
          DEFAULT: "#8B2CF5",        // violeta — solo acentos puntuales, sin glow
          hover: "#A042F8",
          muted: "#5B1FA8",
        },
        danger: {
          DEFAULT: "#E63946",        // rojo carmesí — alertas, "live"
          hover: "#FF4D5A",
        },
        success: {
          DEFAULT: "#22C55E",        // verde — success states
          hover: "#16A34A",
        },
        warning: {
          DEFAULT: "#F59E0B",         // amber
          hover: "#D97706",
        },
        gold: {
          DEFAULT: "#D4AF37",         // dorado para ornamentos
          hover: "#E6C766",
          muted: "#8B7519",
        },
      },
      fontFamily: {
        // Butler Free Version — serif display para títulos
        serif: ["var(--font-butler)", "Georgia", "serif"],
        // Oswald — sans condensada para UI
        sans: ["var(--font-oswald)", "system-ui", "sans-serif"],
        // Mono — Oswald tabular para números
        mono: ["var(--font-oswald)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Headlines Butler
        "hero": ["4.5rem", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "700" }],
        "h1": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" }],
        "h2": ["2rem", { lineHeight: "1.15", fontWeight: "600" }],
        "h3": ["1.5rem", { lineHeight: "1.2", fontWeight: "600" }],
        // UI Oswald
        "label": ["0.75rem", { lineHeight: "1.4", fontWeight: "600", letterSpacing: "0.1em" }],
        "caption": ["0.6875rem", { lineHeight: "1.4", fontWeight: "500", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        "sm": "0.25rem",
        "md": "0.375rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        // Premium sobrio — sin glow masivo
        "sm": "0 1px 2px rgba(0, 0, 0, 0.4)",
        "md": "0 4px 12px rgba(0, 0, 0, 0.4)",
        "lg": "0 8px 24px rgba(0, 0, 0, 0.5)",
        "card": "0 2px 8px rgba(0, 0, 0, 0.3)",
        "border-gold": "0 0 0 1px #D4AF37",  // sutil borde dorado, sin glow
      },
      transitionDuration: {
        "200": "200ms",
        "300": "300ms",
        "500": "500ms",
      },
      transitionTimingFunction: {
        "premium": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-out": "fade-out 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-up": "slide-up 300ms cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
