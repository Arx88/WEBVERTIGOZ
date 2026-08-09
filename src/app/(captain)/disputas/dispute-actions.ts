"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

// Helper: obtener team del capitán logueado
async function getCaptainTeamReg(): Promise<{ account: any; teamReg: any } | null> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account) return null;

  const { data: teamAccount } = (await supabase
    .from("team_account")
    .select("id")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };
  if (!teamAccount) return null;

  const { data: teamReg } = (await supabase
    .from("team_registration")
    .select("id")
    .eq("team_account_id", teamAccount.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };
  if (!teamReg) return null;

  return { account, teamReg };
}

export async function createDisputeAction(fd: FormData): Promise<void> {
  const captainData = await getCaptainTeamReg();
  if (!captainData) throw new Error("No autenticado o sin equipo.");

  const { teamReg } = captainData;

  const matchId = fd.get("match_id") as string;
  const teamRegistrationId = fd.get("team_registration_id") as string;
  const reason = fd.get("reason") as string;
  const description = (fd.get("description") as string)?.trim();
  const screenshotUrl = (fd.get("screenshot_url") as string) || null;

  // Validaciones
  if (!matchId) throw new Error("match_id requerido.");
  if (teamRegistrationId !== teamReg.id) {
    throw new Error("No tenés permiso para crear disputas de este equipo.");
  }
  if (!reason) throw new Error("Motivo requerido.");
  if (!description || description.length < 10) {
    throw new Error("Descripción requerida (mínimo 10 caracteres).");
  }

  const supabase = (await getSupabaseServer()) as any;

  // Validar que el match exista, esté finished, y el team participe
  const { data: match } = (await supabase
    .from("match")
    .select("id, status, finished_at, team_a_id, team_b_id")
    .eq("id", matchId)
    .single()) as { data: any };

  if (!match) throw new Error("Match no encontrado.");
  if (match.status !== "finished") throw new Error("Solo se puede disputar matches finalizados.");
  if (match.team_a_id !== teamRegistrationId && match.team_b_id !== teamRegistrationId) {
    throw new Error("Tu equipo no participa en este match.");
  }

  // Validar ventana de 30 minutos
  if (match.finished_at) {
    const minutesAgo = (Date.now() - new Date(match.finished_at).getTime()) / 60000;
    if (minutesAgo > 30) {
      throw new Error("La ventana de 30 minutos para disputar ya cerró.");
    }
  }

  // Validar que no haya disputa ya abierta para este match + team
  const { data: existing } = (await supabase
    .from("dispute")
    .select("id, status")
    .eq("match_id", matchId)
    .eq("team_registration_id", teamRegistrationId)
    .in("status", ["open", "reviewing"])
    .maybeSingle()) as { data: any };

  if (existing) {
    throw new Error("Ya tenés una disputa abierta para este match.");
  }

  // Crear disputa
  const { error } = await supabase.from("dispute").insert({
    match_id: matchId,
    team_registration_id: teamRegistrationId,
    reason,
    description,
    screenshot_url: screenshotUrl,
    status: "open",
    created_at: new Date().toISOString(),
  });

  if (error) throw new Error(`DB error: ${error.message}`);

  // Cambiar match status a "disputed"
  await supabase
    .from("match")
    .update({ status: "disputed" })
    .eq("id", matchId);

  revalidatePath("/disputas");
  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
}
