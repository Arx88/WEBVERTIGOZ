/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
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
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
