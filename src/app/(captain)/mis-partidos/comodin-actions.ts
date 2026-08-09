"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

// ============================================================
// SERVER ACTIONS PARA USO DE COMODINES POR PARTE DEL CAPITÁN
// ============================================================
//
// Estos actions son invocados por el capitán desde /mis-partidos
// durante la ventana de comodines (status: lineup o comodin_window).
// Validan que el capitán sea del team correcto y que tenga el comodín disponible.

async function getCaptainTeam(): Promise<{ account: any; teamAccount: any; teamReg: any } | null> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = (await supabase
    .from("account")
    .select("id, email, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account) return null;

  const { data: teamAccount } = (await supabase
    .from("team_account")
    .select("id, name")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };
  if (!teamAccount) return null;

  const { data: teamReg } = (await supabase
    .from("team_registration")
    .select("id, status")
    .eq("team_account_id", teamAccount.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };
  if (!teamReg) return null;

  return { account, teamAccount, teamReg };
}

async function validateComodinUsage(
  matchId: string,
  teamRegId: string,
  comodinType: string
): Promise<{ ok: true; inv: any; captainData: any } | { ok: false; error: string }> {
  const captainData = await getCaptainTeam();
  if (!captainData) {
    return { ok: false, error: "No autenticado o sin equipo." };
  }

  // El teamRegId debe ser del capitán
  if (captainData.teamReg.id !== teamRegId) {
    return { ok: false, error: "No tenés permiso para usar comodines de este equipo." };
  }

  const supabase = (await getSupabaseServer()) as any;

  // Validar que el match exista y el team esté en él
  const { data: match } = (await supabase
    .from("match")
    .select("id, status, team_a_id, team_b_id")
    .eq("id", matchId)
    .single()) as { data: any };

  if (!match) {
    return { ok: false, error: "Match no encontrado." };
  }

  if (match.team_a_id !== teamRegId && match.team_b_id !== teamRegId) {
    return { ok: false, error: "Tu equipo no participa en este match." };
  }

  // Validar que el match esté en ventana de comodines
  if (!["lineup", "comodin_window", "open", "drawing"].includes(match.status)) {
    return { ok: false, error: `No se pueden usar comodines en estado '${match.status}'.` };
  }

  // Validar que no se haya usado ya un comodín en este match (excepto INVOCAR PRO)
  const { data: existingUsages } = (await supabase
    .from("comodin_usage")
    .select("id, comodin_type")
    .eq("match_id", matchId)
    .neq("comodin_type", "invocar_pro")) as { data: any[] };

  if (existingUsages && existingUsages.length > 0 && comodinType !== "invocar_pro") {
    return { ok: false, error: "Ya se usó un comodín en este match. Los comodines son mutuamente excluyentes." };
  }

  // Validar disponibilidad en el inventario
  const { data: inv } = (await supabase
    .from("comodin_inventory")
    .select("id, reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
    .eq("team_registration_id", teamRegId)
    .single()) as { data: any };

  if (!inv) {
    return { ok: false, error: "Inventario no encontrado." };
  }

  const availableMap: Record<string, number> = {
    reroll: inv.reroll_available,
    anular: inv.anular_available,
    elegir_rival: inv.elegir_rival_available,
    invocar_pro: inv.invocar_pro_available,
  };

  if ((availableMap[comodinType] ?? 0) <= 0) {
    return { ok: false, error: `No tenés ${comodinType} disponible.` };
  }

  return { ok: true, inv, captainData };
}

async function executeComodinUsage(
  matchId: string,
  teamRegId: string,
  comodinType: string,
  invField: string,
  revalidatePaths: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validation = await validateComodinUsage(matchId, teamRegId, comodinType);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { inv } = validation;
  const supabase = (await getSupabaseServer()) as any;

  // Decrementar inventario
  const { error: invErr } = await supabase
    .from("comodin_inventory")
    .update({
      [invField]: inv[invField] - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inv.id);

  if (invErr) return { ok: false, error: `DB error: ${invErr.message}` };

  // Registrar uso
  const { error: usageErr } = await supabase.from("comodin_usage").insert({
    comodin_inventory_id: inv.id,
    match_id: matchId,
    comodin_type: comodinType,
    executed_at: new Date().toISOString(),
  });

  if (usageErr) return { ok: false, error: `DB error: ${usageErr.message}` };

  // Revalidate
  revalidatePaths.forEach((p) => revalidatePath(p));

  return { ok: true };
}

// ============================================================
// 1. RE-GIRAR
// ============================================================

export async function useRerollAction(matchId: string, teamRegId: string, _fd: FormData): Promise<void> {
  const result = await executeComodinUsage(matchId, teamRegId, "reroll", "reroll_available", [
    `/mis-partidos`,
    `/partido/${matchId}`,
    `/equipos/${teamRegId}`,
    `/admin/partido/${matchId}`,
  ]);
  if (!result.ok) {
    throw new Error(result.error);
  }
}

// ============================================================
// 2. ANULAR JUGADOR
// ============================================================

export async function useAnularAction(matchId: string, teamRegId: string, _fd: FormData): Promise<void> {
  const result = await executeComodinUsage(matchId, teamRegId, "anular", "anular_available", [
    `/mis-partidos`,
    `/partido/${matchId}`,
    `/equipos/${teamRegId}`,
    `/admin/partido/${matchId}`,
  ]);
  if (!result.ok) {
    throw new Error(result.error);
  }
}

// ============================================================
// 3. ELEGIR RIVAL
// ============================================================

export async function useElegirRivalAction(matchId: string, teamRegId: string, _fd: FormData): Promise<void> {
  const result = await executeComodinUsage(matchId, teamRegId, "elegir_rival", "elegir_rival_available", [
    `/mis-partidos`,
    `/partido/${matchId}`,
    `/equipos/${teamRegId}`,
    `/admin/partido/${matchId}`,
  ]);
  if (!result.ok) {
    throw new Error(result.error);
  }
}
