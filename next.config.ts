/** @type {import('next').NextConfig} */
import path from "path";

const nextConfig = {
  output: "standalone",
  // Root explícito de Turbopack: hay un package-lock.json huérfano en el HOME
  // del usuario y Next lo elegía como workspace root, haciendo que el file
  // watcher escanee todo el home -> compilaciones de 20s+ y fuga de memoria
  // del dev server (6-10GB). Acá lo anclamos al proyecto.
  turbopack: {
    root: path.resolve("."),
  },
  reactStrictMode: true,
  // No revelar el framework en respuestas (X-Powered-By: Next.js)
  poweredByHeader: false,
  // typedRoutes se activará cuando estén todas las rutas creadas
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "aoe2companion.com" },
      { protocol: "https", hostname: "data.aoe2companion.com" },
      { protocol: "https", hostname: "images.aoe2companion.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
    // Allow unoptimized images for local /landing/ assets
    unoptimized: false,
  },
  // Aumentar timeout para builds con muchos assets pesados
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  // Security headers en TODAS las respuestas (incluye assets estáticos).
  // Sin CSP estricta a propósito: el sitio usa estilos/scripts inline y
  // embeds externos (Twitch/YouTube); un CSP mal calibrado rompe la UI.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Anti-clickjacking. El overlay de OBS carga top-level (browser
          // source), así que SAMEORIGIN no le afecta.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
