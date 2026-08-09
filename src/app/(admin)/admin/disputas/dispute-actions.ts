"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

export async function resolveDisputeAction(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) throw new Error("No autorizado.");

  const disputeId = fd.get("dispute_id") as string;
  const resolution = fd.get("resolution") as string; // "resolved" | "rejected"
  const adminResponse = (fd.get("admin_response") as string)?.trim();

  if (!disputeId) throw new Error("dispute_id requerido.");
  if (!resolution || !["resolved", "rejected"].includes(resolution)) {
    throw new Error("Resolución inválida.");
  }
  if (!adminResponse || adminResponse.length < 5) {
    throw new Error("Respuesta requerida (mínimo 5 caracteres).");
  }

  const supabase = (await getSupabaseServer()) as any;

  // Buscar disputa
  const { data: dispute } = (await supabase
    .from("dispute")
    .select("id, status, match_id")
    .eq("id", disputeId)
    .single()) as { data: any };

  if (!dispute) throw new Error("Disputa no encontrada.");
  if (dispute.status !== "open" && dispute.status !== "reviewing") {
    throw new Error("La disputa ya fue resuelta.");
  }

  // Actualizar disputa
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("dispute")
    .update({
      status: resolution,
      admin_response: adminResponse,
      resolved_at: now,
      resolved_by: admin.id,
    })
    .eq("id", disputeId);

  if (error) throw new Error(`DB error: ${error.message}`);

  // Restaurar match status a "finished" (estaba "disputed")
  await supabase
    .from("match")
    .update({ status: "finished" })
    .eq("id", dispute.match_id);

  revalidatePath("/admin/disputas");
  revalidatePath("/disputas");
  revalidatePath(`/admin/partido/${dispute.match_id}`);
  revalidatePath(`/partido/${dispute.match_id}`);
}
