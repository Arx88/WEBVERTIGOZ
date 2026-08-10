"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Confirma "ESTOY LISTO" para un match.
 * El capitán hace click y se marca ready_a_at o ready_b_at.
 * Cuando AMBOS equipos están ready, el match pasa a status="open" (HABILITADA).
 */
export async function confirmReadyAction(matchId: string, fd: FormData): Promise<void> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  // Buscar account
  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account) throw new Error("Account no encontrado.");

  // Buscar team_account del usuario
  const { data: teamAccount } = (await supabase
    .from("team_account")
    .select("id")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };
  if (!teamAccount) throw new Error("No tenés equipo.");

  // Buscar team_registration activa
  const { data: reg } = (await supabase
    .from("team_registration")
    .select("id, status")
    .eq("team_account_id", teamAccount.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };
  if (!reg) throw new Error("No tenés inscripción activa.");

  // Buscar el match
  const { data: match } = (await supabase
    .from("match")
    .select("id, status, team_a_id, team_b_id, ready_a_at, ready_b_at")
    .eq("id", matchId)
    .single()) as { data: any };
  if (!match) throw new Error("Match no encontrado.");

  // Validar que el team del capitán participa en este match
  if (match.team_a_id !== reg.id && match.team_b_id !== reg.id) {
    throw new Error("Tu equipo no participa en este match.");
  }

  // Validar que el match esté en estado scheduled
  if (match.status !== "scheduled") {
    throw new Error(`El match ya no está en estado programado (actual: ${match.status}).`);
  }

  const now = new Date().toISOString();
  const isTeamA = match.team_a_id === reg.id;
  const readyField = isTeamA ? "ready_a_at" : "ready_b_at";

  // Marcar este team como ready
  const { error } = await supabase
    .from("match")
    .update({ [readyField]: now, updated_at: now })
    .eq("id", matchId);

  if (error) throw new Error(`DB error: ${error.message}`);

  // Verificar si AMBOS teams están ready
  const { data: updated } = (await supabase
    .from("match")
    .select("ready_a_at, ready_b_at, status")
    .eq("id", matchId)
    .single()) as { data: any };

  if (updated?.ready_a_at && updated?.ready_b_at) {
    // Ambos ready → HABILITADA (status = open)
    await supabase
      .from("match")
      .update({ status: "open", updated_at: now })
      .eq("id", matchId);
  }

  revalidatePath("/mis-partidos");
  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
}

/**
 * Inicia la ventana de comodines después del sorteo.
 * Cambia status de "lineup" a "comodin_window" y registra el timestamp.
 */
export async function startComodinWindowAction(matchId: string, fd: FormData): Promise<void> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) {
    throw new Error("No autorizado.");
  }

  const { error } = await supabase
    .from("match")
    .update({
      status: "comodin_window",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) throw new Error(`DB error: ${error.message}`);

  revalidatePath(`/admin/partido/${matchId}`);
  revalidatePath(`/partido/${matchId}`);
  revalidatePath("/mis-partidos");
}

/**
 * Cierra la ventana de comodines y comienza la partida.
 */
export async function startMatchAction(matchId: string, fd: FormData): Promise<void> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) {
    throw new Error("No autorizado.");
  }

  // Marcar el primer match_game como in_progress
  const { data: games } = (await supabase
    .from("match_game")
    .select("id, status")
    .eq("match_id", matchId)
    .order("game_number", { ascending: true })) as { data: any[] };

  const pendingGame = games?.find((g: any) => g.status === "lineup" || g.status === "pending");
  if (pendingGame) {
    await supabase
      .from("match_game")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingGame.id);
  }

  const { error } = await supabase
    .from("match")
    .update({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) throw new Error(`DB error: ${error.message}`);

  revalidatePath(`/admin/partido/${matchId}`);
  revalidatePath(`/partido/${matchId}`);
  revalidatePath("/mis-partidos");
}
