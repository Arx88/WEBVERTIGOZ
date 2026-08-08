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
    const { data: accountRow, error: accErr } = await supabase
      .from("account")
      .select("id")
      .eq("supabase_auth_id", user.id)
      .single();

    let accountId: string;
    if (!accountRow) {
      const { data: newAcc, error: insertAccErr } = await supabase
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
      if (insertAccErr || !newAcc) return { ok: false as const, error: `Error creando account: ${insertAccErr?.message ?? "desconocido"}` };
      accountId = newAcc.id;
    } else {
      accountId = accountRow.id;
    }

    // 2. Buscar edition
    const { data: edition, error: edErr } = await supabase
      .from("tournament_edition")
      .select("id, civs_base, civs_extra_finalist, elo_cap, elo_tolerance")
      .eq("slug", "vertigo-2026-1")
      .single();
    if (edErr || !edition) return { ok: false as const, error: `Edición no encontrada: ${edErr?.message ?? "desconocido"}` };

    // 3. Crear team_account
    // Los nombres de columnas en Postgres son snake_case (owner_id, emblem_id)
    // No camelCase como en el schema de Drizzle
    const { data: team, error: teamErr } = await supabase
      .from("team_account")
      .insert({
        owner_id: accountId,
        name: data.teamName,
        tagline: data.teamTagline || null,
        emblem_id: null,
      })
      .select("id")
      .single();
    if (teamErr || !team) return { ok: false as const, error: `Error creando equipo: ${teamErr?.message ?? "desconocido"}` };

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
    const { data: reg, error: regErr } = await supabase
      .from("team_registration")
      .insert({
        team_account_id: team.id,
        tournament_edition_id: edition.id,
        base_civ_ids: data.baseCivIds,
        extra_civ_ids: data.extraCivIds,
        elo_freeze_snapshot: totalElo,
        elo_verification_status: data.players.some((p) => !p.isVerified) ? "pending" : "verified",
        restream_accepted: data.restreamAccepted,
        handbook_downloaded_at: data.handbookDownloadedAt,
        terms_accepted_at: data.termsAcceptedAt,
        submitted_at: new Date(),
        status: "pending",
      })
      .select("id")
      .single();
    if (regErr || !reg) return { ok: false as const, error: `Error creando inscripción: ${regErr?.message ?? "desconocido"}` };

    // 6. Insertar jugadores
    const { error: playersErr } = await supabase.from("player_registration").insert(
      data.players.map((p) => ({
        team_registration_id: reg.id,
        aoe2_profile_id: p.aoe2ProfileId!,
        aoe2_steam_id: p.steamId || null,
        display_name: p.displayName,
        country: p.country || null,
        clan: p.clan || null,
        is_verified: p.isVerified,
        max_rating_rm_1v1: p.maxRatingRm1v1 ?? null,
        rating_rm_1v1_current: p.ratingRm1v1Current ?? null,
        is_captain: p.isCaptain,
        linked_profiles: [],
        verification_payload: null,
      }))
    );
    if (playersErr) return { ok: false as const, error: `Error cargando jugadores: ${playersErr.message}` };

    revalidatePath("/mi-equipo");
    return { ok: true as const, teamRegistrationId: reg.id };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}
