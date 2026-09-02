import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getSupabaseServiceRole } from "@/lib/supabase/server";

/**
 * POST /api/admin/notifications/test — vista previa real de un aviso.
 * Crea UNA notificación para la cuenta del propio admin (toast + campana +
 * historial + push si está suscripto) con el borrador actual del form,
 * para ver exactamente cómo lo van a recibir los destinatarios.
 * No toca broadcast_log: los tests no son envíos reales.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const account = await requireAdmin();
  if (!account) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    title?: string;
    body?: string;
    link?: string;
  };
  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "El título del aviso es obligatorio" }, { status: 400 });
  }

  try {
    const service = getSupabaseServiceRole() as any;
    const { error } = await service.from("notification").insert({
      account_id: account.id,
      type: (body.type ?? "broadcast") || "broadcast",
      title,
      body: (body.body ?? "").trim() || null,
      link: (body.link ?? "").trim() || null,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[broadcast-test] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}