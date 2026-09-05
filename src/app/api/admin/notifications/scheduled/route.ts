import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin-audit";

/**
 * DELETE /api/admin/notifications/scheduled?id=…
 * Cancela un aviso programado pendiente (status → cancelled).
 * Solo admin/super_admin.
 */
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const account = await requireAdmin();
  if (!account) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }

  try {
    const service = getSupabaseServiceRole() as any;
    const { data, error } = await service
      .from("scheduled_broadcast")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, title");
    if (error) throw new Error(error.message);
    if (!data?.length) {
      return NextResponse.json(
        { error: "No existe un aviso pendiente con ese id" },
        { status: 404 }
      );
    }
    await logAdminAction({
      supabase: service,
      accountId: account.id,
      action: "cancel_scheduled_broadcast",
      entityType: "scheduled_broadcast",
      entityId: id,
      entityLabel: data[0]?.title ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scheduled-cancel] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
