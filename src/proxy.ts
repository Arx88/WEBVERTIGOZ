import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware de protección de rutas.
 *
 * - /admin/* → requiere sesión + role admin/super_admin (el check de role se hace en el layout)
 * - /captain/* → requiere sesión
 *
 * El middleware solo verifica que haya sesión. El check de role específico
 * se hace en el layout de cada route group (más eficiente que hacer query
 * a la DB en cada request).
 *
 * Performance/resiliencia: las rutas PÚBLICAS no tocan Supabase acá.
 * Solo las protegidas llaman a auth, con timeout: si Supabase se cuelga,
 * el resto del sitio sigue funcionando y la ruta protegida degrada a
 * /login en vez de colgar el request (504).
 */

const AUTH_TIMEOUT_MS = 3000;

export async function proxy(req: NextRequest) {
  // Rutas protegidas (requieren sesión)
  // IMPORTANTE: NO incluir "/caster" — la página /casters es pública y
  // startsWith("/caster") la mandaba a login. No existen rutas /caster/* privadas.
  // /overlay es para OBS Browser Source (sin sesión) — también público.
  const protectedPaths = ["/admin", "/captain"];
  const isProtected = protectedPaths.some((p) =>
    req.nextUrl.pathname.startsWith(p)
  );

  // Páginas públicas: sin llamada a auth. Si Supabase está lento/caído,
  // la landing, el bracket, el fixture, etc. siguen cargando igual.
  if (!isProtected) return NextResponse.next();

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

  // getUser() con timeout: un bache de Supabase no puede colgar el request.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const user = await Promise.race([
    supabase.auth.getUser()
      .then((r) => r.data.user)
      .catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), AUTH_TIMEOUT_MS);
    }),
  ]);
  if (timer) clearTimeout(timer);

  if (!user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // El redirect de usuarios logueados que entran a /login lo resuelve la
  // propia página según el rol (spectator → /apuestas, caster → /casters).

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|mp4|webm|pdf|ico|css|js|map|html)$).*)",
  ],
};
