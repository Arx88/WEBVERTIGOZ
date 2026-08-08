import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware de protección de rutas.
 *
 * - /admin/* → requiere sesión + role admin/super_admin (el check de role se hace en el layout)
 * - /captain/* → requiere sesión
 * - /caster/* → requiere sesión
 *
 * El middleware solo verifica que haya sesión. El check de role específico
 * se hace en el layout de cada route group (más eficiente que hacer query
 * a la DB en cada request).
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Crear cliente Supabase que lee las cookies del request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options as any);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas protegidas (requieren sesión)
  const protectedPaths = ["/admin", "/captain", "/caster"];
  const isProtected = protectedPaths.some((p) =>
    req.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Si está logueado y va a /login o /registro, redirigir a /mi-equipo
  if (
    user &&
    (req.nextUrl.pathname === "/login" ||
      req.nextUrl.pathname.startsWith("/registro"))
  ) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/mi-equipo";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Matchea todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - public/* (assets públicos)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|mp4|webm|pdf|ico|css|js|map)$).*)",
  ],
};
