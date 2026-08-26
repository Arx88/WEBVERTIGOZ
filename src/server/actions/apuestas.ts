"use server";

/**
 * VÉRTIGO Cup — Apuestas de espectadores (pari-mutuel con puntos).
 *
 * Reglas de negocio (espejo de la migración 0004):
 *   - Al registrarse como espectador recibe un wallet con 1000 puntos
 *     (trigger grant_spectator_wallet).
 *   - 1 apuesta por espectador por llave, monto libre hasta su saldo.
 *   - Se puede apostar mientras la llave esté 'scheduled' con ambos
 *     equipos definidos. Cancelar = delete del bet → reintegro.
 *   - La liquidación (finished/forfeit/cancelled) la hace el trigger
 *     settle_match_bets, no el código de la app.
 */

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { GENERIC_AVATARS } from "@/lib/constants";
import { ensureDeviceForSession } from "@/lib/device-trust";

// Nota: WELCOME_POINTS vive en @/lib/constants (un archivo "use server"
// solo puede exportar funciones async).

type ActionResult = { ok: true } | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Sesión actual + su account. El rol se valida donde haga falta. */
async function requireAccount(): Promise<
  | { ok: false; error: string }
  | { ok: true; supabase: any; user: any; account: any }
> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: account } = (await supabase
    .from("account")
    .select("id, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account) return { ok: false, error: "Cuenta no encontrada." };

  return { ok: true, supabase, user, account };
}

// ─────────────────────────────────────────────────────────────
// Registro de espectador
// ─────────────────────────────────────────────────────────────

/**
 * Crea la cuenta de auth (auto-confirm vía admin API), auto-logea y
 * promueve el account a rol 'spectator'. El trigger
 * grant_spectator_wallet le acredita los 1000 puntos de bienvenida.
 */
export async function registerSpectatorAction(formData: FormData): Promise<ActionResult> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!displayName) return { ok: false, error: "Elegí un nombre para aparecer en el ranking." };
  if (!email || !email.includes("@")) return { ok: false, error: "Ingresá un email válido." };
  if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };

  const admin = getSupabaseServiceRole() as any;

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "spectator", display_name: displayName },
  });
  if (createErr) {
    if (/already/i.test(createErr.message)) {
      return { ok: false, error: "Ya existe una cuenta con ese email. Iniciá sesión para entrar." };
    }
    return { ok: false, error: createErr.message };
  }

  // Auto-login (setea las cookies de sesión)
  const supabase = (await getSupabaseServer()) as any;
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
  if (loginErr) return { ok: false, error: `Cuenta creada, pero falló el login: ${loginErr.message}` };

  // Promover el account a spectator (el trigger de auth lo creó como 'owner').
  // El UPDATE dispara grant_spectator_wallet → wallet con 1000 puntos.
  const { data: accountRow } = (await admin
    .from("account")
    .select("id")
    .eq("supabase_auth_id", newUser.user.id)
    .maybeSingle()) as { data: any };

  const avatarKey = GENERIC_AVATARS[Math.floor(Math.random() * GENERIC_AVATARS.length)];

  if (accountRow) {
    const { error: upErr } = await admin
      .from("account")
      .update({ role: "spectator", display_name: displayName, avatar_key: avatarKey })
      .eq("id", accountRow.id);
    if (upErr) return { ok: false, error: `Error activando tu cuenta de espectador: ${upErr.message}` };
  } else {
    // Fallback: el trigger handle_new_user no corrió
    const { error: insErr } = await admin
      .from("account")
      .insert({
        supabase_auth_id: newUser.user.id,
        email,
        role: "spectator",
        display_name: displayName,
        avatar_key: avatarKey,
      });
    if (insErr) return { ok: false, error: `Error creando tu cuenta de espectador: ${insErr.message}` };
  }

  revalidatePath("/apuestas");
  await ensureDeviceForSession();
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Apostar
// ─────────────────────────────────────────────────────────────

/**
 * Coloca una apuesta en una llave. Valida en el servidor:
 * rol spectator, llave 'scheduled' con ambos equipos, pick válido,
 * stake entero ≥ 1 y ≤ saldo. El débito lo hace el trigger on_bet_placed.
 */
export async function placeBetAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAccount();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { account } = auth;

  if (account.role !== "spectator") {
    return { ok: false, error: "Solo los espectadores pueden apostar." };
  }

  const matchId = String(formData.get("match_id") ?? "").trim();
  const pickedTeamId = String(formData.get("picked_team_id") ?? "").trim();
  const stakeRaw = String(formData.get("stake") ?? "").trim();

  if (!matchId) return { ok: false, error: "Falta la llave." };
  if (!pickedTeamId) return { ok: false, error: "Elegí qué equipo gana." };

  const stake = Number.parseInt(stakeRaw, 10);
  if (!Number.isFinite(stake) || stake < 1) {
    return { ok: false, error: "El monto debe ser un entero de al menos 1 punto." };
  }

  const admin = getSupabaseServiceRole() as any;

  // Saldo authoritative (service role, no el del cliente)
  const { data: wallet } = (await admin
    .from("spectator_wallet")
    .select("balance")
    .eq("account_id", account.id)
    .maybeSingle()) as { data: any };
  if (!wallet) return { ok: false, error: "No tenés wallet de espectador. Registrate como espectador para recibir tus puntos." };
  if (stake > wallet.balance) {
    return { ok: false, error: `Saldo insuficiente: tenés ${wallet.balance} puntos.` };
  }

  // La llave debe estar sin abrir y con ambos equipos definidos
  const { data: match } = (await admin
    .from("match")
    .select("id, status, team_a_id, team_b_id")
    .eq("id", matchId)
    .single()) as { data: any };
  if (!match) return { ok: false, error: "Llave no encontrada." };
  if (match.status !== "scheduled") {
    return { ok: false, error: "Esta llave ya abrió: no se aceptan más apuestas." };
  }
  if (!match.team_a_id || !match.team_b_id) {
    return { ok: false, error: "Todavía no se saben los equipos de esta llave." };
  }
  if (pickedTeamId !== match.team_a_id && pickedTeamId !== match.team_b_id) {
    return { ok: false, error: "El equipo elegido no juega esta llave." };
  }

  // 1 apuesta por espectador por llave
  const { data: existing } = (await admin
    .from("bet")
    .select("id")
    .eq("spectator_account_id", account.id)
    .eq("match_id", matchId)
    .maybeSingle()) as { data: any };
  if (existing) {
    return { ok: false, error: "Ya apostaste en esta llave. Cancelá tu apuesta si querés cambiarla." };
  }

  const { error: insErr } = await admin.from("bet").insert({
    spectator_account_id: account.id,
    match_id: matchId,
    picked_team_id: pickedTeamId,
    stake,
    status: "pending",
  });
  if (insErr) {
    if (/bet_unique_spectator_match/i.test(insErr.message)) {
      return { ok: false, error: "Ya apostaste en esta llave." };
    }
    if (/spectator_wallet_balance_nonnegative/i.test(insErr.message)) {
      return { ok: false, error: "Saldo insuficiente." };
    }
    return { ok: false, error: `No se pudo registrar la apuesta: ${insErr.message}` };
  }

  revalidatePath("/apuestas");
  revalidatePath(`/partido/${matchId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Cancelar apuesta (reintegro)
// ─────────────────────────────────────────────────────────────

/**
 * Cancela una apuesta pendiente mientras la llave siga 'scheduled'.
 * El delete dispara el trigger refund_bet_on_delete → reintegro.
 * Cancelar y volver a apostar permite "cambiar" el pick.
 */
export async function cancelBetAction(betId: string): Promise<ActionResult> {
  const auth = await requireAccount();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { account } = auth;

  if (account.role !== "spectator") {
    return { ok: false, error: "Solo los espectadores pueden cancelar apuestas." };
  }
  if (!betId) return { ok: false, error: "Falta la apuesta." };

  const admin = getSupabaseServiceRole() as any;

  const { data: bet } = (await admin
    .from("bet")
    .select("id, status, match_id, spectator_account_id")
    .eq("id", betId)
    .maybeSingle()) as { data: any };
  if (!bet) return { ok: false, error: "Apuesta no encontrada." };
  if (bet.spectator_account_id !== account.id) {
    return { ok: false, error: "Solo podés cancelar tus propias apuestas." };
  }
  if (bet.status !== "pending") {
    return { ok: false, error: "Esta apuesta ya está liquidada, no se puede cancelar." };
  }

  const { data: match } = (await admin
    .from("match")
    .select("id, status")
    .eq("id", bet.match_id)
    .single()) as { data: any };
  if (!match || match.status !== "scheduled") {
    return { ok: false, error: "La llave ya abrió: tu apuesta queda en juego hasta que termine." };
  }

  const { error: delErr } = await admin.from("bet").delete().eq("id", betId);
  if (delErr) return { ok: false, error: `No se pudo cancelar la apuesta: ${delErr.message}` };

  revalidatePath("/apuestas");
  revalidatePath(`/partido/${bet.match_id}`);
  return { ok: true };
}
