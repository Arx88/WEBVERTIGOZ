"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { GENERIC_AVATARS } from "@/lib/constants";
import type { WizardData } from "@/components/wizard/wizard-context";

// ============================================================
// Auth — sin email de confirmación (admin API)
// ============================================================

export async function signUpOrLogin(data: WizardData) {
  const supabase = await getSupabaseServer();

  if (data.existingAccount) {
    const { data: result, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, user: result.user };
  }

  // Signup vía admin API (no manda email, confirma directo)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { role: "owner", team_name: data.teamName },
  });

  if (createErr) return { ok: false as const, error: createErr.message };

  // Auto-login
  const { data: loginResult, error: loginErr } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  return { ok: true as const, user: loginErr ? newUser.user : loginResult.user };
}

// ============================================================
// Submit wizard completo
// ============================================================

export async function submitWizard(data: WizardData) {
  try {
    const supabase = (await getSupabaseServer()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, error: "No autenticado." };

    // 1. Buscar o crear account
    const { data: accountRow } = await supabase
      .from("account")
      .select("id")
      .eq("supabase_auth_id", user.id)
      .single();

    let accountId: string;
    if (!accountRow) {
      const { data: newAcc } = await supabase
        .from("account")
        .insert({
          supabase_auth_id: user.id,
          email: user.email!,
          role: "owner",
          avatarKey: GENERIC_AVATARS[Math.floor(Math.random() * GENERIC_AVATARS.length)],
          display_name: data.teamName,
        })
        .select("id")
        .single();
      accountId = newAcc.id;
    } else {
      accountId = accountRow.id;
    }

    // 2. Buscar edition
    const { data: edition } = await supabase
      .from("tournament_edition")
      .select("id, civs_base, civs_extra_finalist, elo_cap, elo_tolerance")
      .eq("slug", "vertigo-2026-1")
      .single();
    if (!edition) return { ok: false as const, error: "Edición no encontrada." };

    // 3. Crear team_account
    const { data: team } = await supabase
      .from("team_account")
      .insert({
        ownerId: accountId,
        name: data.teamName,
        tagline: data.teamTagline || null,
        emblemId: data.emblemId || null,
      })
      .select("id")
      .single();

    // 4. Validaciones
    const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
    const maxElo = (edition.elo_cap ?? 3500) + (edition.elo_tolerance ?? 20);
    if (totalElo > maxElo) {
      return { ok: false as const, error: `ELO total ${totalElo} excede el máximo ${maxElo}.` };
    }
    const expectedBase = edition.civs_base ?? 9;
    const expectedExtra = edition.civs_extra_finalist ?? 3;
    if (data.baseCivIds.length !== expectedBase) {
      return { ok: false as const, error: `Debes elegir ${expectedBase} civs base.` };
    }
    if (data.extraCivIds.length !== expectedExtra) {
      return { ok: false as const, error: `Debes elegir ${expectedExtra} civs extra.` };
    }
    const all = [...data.baseCivIds, ...data.extraCivIds];
    if (new Set(all).size !== all.length) {
      return { ok: false as const, error: "Civs duplicadas." };
    }
    if (!data.handbookDownloadedAt) return { ok: false as const, error: "Descargá el handbook." };
    if (!data.restreamAccepted || !data.termsAcceptedAt) return { ok: false as const, error: "Aceptá los términos." };
    if (data.players.filter((p) => p.isCaptain).length !== 1) {
      return { ok: false as const, error: "Debe haber 1 capitán." };
    }

    // 5. Crear team_registration
    const { data: reg } = await supabase
      .from("team_registration")
      .insert({
        teamAccountId: team.id,
        tournamentEditionId: edition.id,
        baseCivIds: data.baseCivIds,
        extraCivIds: data.extraCivIds,
        eloFreezeSnapshot: totalElo,
        eloVerificationStatus: data.players.some((p) => !p.isVerified) ? "pending" : "verified",
        restreamAccepted: data.restreamAccepted,
        handbookDownloadedAt: data.handbookDownloadedAt,
        termsAcceptedAt: data.termsAcceptedAt,
        submittedAt: new Date(),
        status: "pending",
      })
      .select("id")
      .single();

    // 6. Insertar jugadores
    await supabase.from("player_registration").insert(
      data.players.map((p) => ({
        teamRegistrationId: reg.id,
        aoe2ProfileId: p.aoe2ProfileId!,
        aoe2SteamId: p.steamId || null,
        displayName: p.displayName,
        country: p.country || null,
        clan: p.clan || null,
        isVerified: p.isVerified,
        maxRatingRm1v1: p.maxRatingRm1v1 ?? null,
        ratingRm1v1Current: p.ratingRm1v1Current ?? null,
        isCaptain: p.isCaptain,
        linkedProfiles: [],
        verificationPayload: null,
      }))
    );

    revalidatePath("/mi-equipo");
    return { ok: true as const, teamRegistrationId: reg.id };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}
