import { NextResponse } from "next/server";

/**
 * Guard para endpoints de desarrollo/administración que NO deben existir
 * en producción bajo ninguna circunstancia (ej. exec-sql, create-super-admin,
 * promote-to-super-admin).
 *
 * Lógica:
 *  - Si NODE_ENV === "production"  → bloquear (404)
 *  - Si ADMIN_EXEC_TOKEN está vacío o ausente → bloquear (404)
 *  - Caso contrario (dev con token seteado) → permitir (return null)
 *
 * Devuelve 404 (no 403/503) deliberadamente: un 403 confirma que la ruta
 * existe y está protegida, un 503 confirma que existe pero está mal
 * configurada. Un 404 la hace indistinguible de cualquier ruta inexistente
 * para quien escanee endpoints.
 *
 * Uso:
 *   const blocked = assertDevEndpointAllowed();
 *   if (blocked) return blocked;
 *   // ... lógica del endpoint (solo se alcanza en dev con token)
 */
export function assertDevEndpointAllowed(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!process.env.ADMIN_EXEC_TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
