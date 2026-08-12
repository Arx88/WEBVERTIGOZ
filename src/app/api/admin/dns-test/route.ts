import { NextResponse } from "next/server";
import { promises as dns } from "dns";
import net from "net";
import { requireAdmin } from "@/lib/auth/admin-guard";

/**
 * GET /api/admin/dns-test
 * Diagnóstico de conectividad TCP a los poolers de Supabase.
 * Requiere sesión admin autenticada.
 *
 * SEGURIDAD: SAFE para producción. Protegido con requireAdmin() (sesión
 * autenticada con rol admin/super_admin via Supabase Auth), no por un header
 * estático. Solo realiza conexiones TCP de solo-lectura a hosts conocidos
 * (poolers de Supabase) — no ejecuta operaciones sensibles ni expone datos
 * más allá de si un puerto responde o no. No requiere el dev-endpoint-guard.
 */
export async function GET() {
  const account = await requireAdmin();
  if (!account) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tests: Array<{ name: string; ok: boolean; detail?: string }> = [];

  // Para cada región, probar conexión TCP al pooler en puerto 5432 y 6543
  const regions = ["us-east-1", "us-west-1", "eu-west-1", "eu-central-1", "ap-southeast-1"];

  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    for (const port of [5432, 6543]) {
      const name = `tcp:${host}:${port}`;
      await new Promise<void>((resolve) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          tests.push({ name, ok: false, detail: "timeout 5s" });
          resolve();
        }, 5000);
        socket.connect(port, host, () => {
          clearTimeout(timeout);
          socket.destroy();
          tests.push({ name, ok: true });
          resolve();
        });
        socket.on("error", (err) => {
          clearTimeout(timeout);
          tests.push({ name, ok: false, detail: err.message.slice(0, 80) });
          resolve();
        });
      });
    }
  }

  return NextResponse.json({ tests });
}
