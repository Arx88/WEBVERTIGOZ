"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { GENERIC_AVATARS } from "@/lib/constants";
import { validateTeamEloCap } from "@/lib/aoe2";
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
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false as const, error: "Servidor no configurado para signup." };
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
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
  let createdTeamAccountId: string | null = null;
  let createdTeamRegistrationId: string | null = null;

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

    // 3. Validar que los 3 aoe2ProfileId sean distintos
    const profileIds = data.players.map((p) => p.aoe2ProfileId).filter((id): id is number => id != null);
    if (profileIds.length !== 3) {
      return { ok: false as const, error: "Los 3 jugadores deben tener perfil de AoE2 Companion cargado." };
    }
    const uniqueProfileIds = new Set(profileIds);
    if (uniqueProfileIds.size !== 3) {
      return { ok: false as const, error: "Los 3 jugadores deben tener perfiles de AoE2 Companion distintos. No podés cargar el mismo jugador dos veces." };
    }

    // 3b. Validar emblemId: formato UUID + existe y está activo en la BD
    // (la columna emblem_id es uuid con FK a emblem — un valor tipo "reino-4" revienta en Postgres)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!data.emblemId || !UUID_RE.test(data.emblemId)) {
      return { ok: false as const, error: "El escudo elegido no es válido. Volvé al paso 2 y elegí un escudo de la lista." };
    }
    const { data: emblemRow } = await supabase
      .from("emblem")
      .select("id")
      .eq("id", data.emblemId)
      .eq("is_active", true)
      .maybeSingle();
    if (!emblemRow) {
      return { ok: false as const, error: "El escudo elegido no existe o ya no está disponible. Volvé al paso 2 y elegí otro." };
    }

    // 4. Re-validar ELO server-side contra AoE2 Companion (no confiar en cliente)
    const eloCap = edition.elo_cap ?? 3500;
    const eloTolerance = edition.elo_tolerance ?? 20;
    const maxAllowed = eloCap + eloTolerance;

    const eloValidation = await validateTeamEloCap(profileIds, eloCap, eloTolerance);
    if (!eloValidation.isWithinCap) {
      return {
        ok: false as const,
        error: `ELO total verificado en servidor (${eloValidation.totalElo}) excede el máximo permitido (${maxAllowed}). Revisá los perfiles de tus jugadores.`,
      };
    }

    // Usar los valores frescos del servidor (no los del cliente)
    const serverEloSnapshot = eloValidation.totalElo;

    // 5. Validaciones de civs y términos
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

    // 6. Crear team_account (con emblem_id del wizard, no null)
    const { data: team, error: teamErr } = await supabase
      .from("team_account")
      .insert({
        owner_id: accountId,
        name: data.teamName,
        tagline: data.teamTagline || null,
        emblem_id: data.emblemId, // ← fix bug #10: antes era null
      })
      .select("id")
      .single();
    if (teamErr || !team) return { ok: false as const, error: `Error creando equipo: ${teamErr?.message ?? "desconocido"}` };
    createdTeamAccountId = team.id;

    // 7. Crear team_registration (con ELO snapshot del servidor)
    const { data: reg, error: regErr } = await supabase
      .from("team_registration")
      .insert({
        team_account_id: team.id,
        tournament_edition_id: edition.id,
        base_civ_ids: data.baseCivIds,
        extra_civ_ids: data.extraCivIds,
        elo_freeze_snapshot: serverEloSnapshot, // ← valor fresco del servidor
        elo_verification_status: eloValidation.perPlayer.some((p) => p.status === "pending" || p.status === "hidden") ? "pending" : "verified",
        restream_accepted: data.restreamAccepted,
        handbook_downloaded_at: data.handbookDownloadedAt,
        terms_accepted_at: data.termsAcceptedAt,
        submitted_at: new Date(),
        status: "pending",
      })
      .select("id")
      .single();
    if (regErr || !reg) {
      // Cleanup: borrar team_account creado
      await supabase.from("team_account").delete().eq("id", team.id);
      createdTeamAccountId = null;
      return { ok: false as const, error: `Error creando inscripción: ${regErr?.message ?? "desconocido"}` };
    }
    createdTeamRegistrationId = reg.id;

    // 8. Insertar jugadores
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
    if (playersErr) {
      // Cleanup: borrar team_registration y team_account creados
      await supabase.from("team_registration").delete().eq("id", reg.id);
      await supabase.from("team_account").delete().eq("id", team.id);
      createdTeamRegistrationId = null;
      createdTeamAccountId = null;
      return { ok: false as const, error: `Error cargando jugadores: ${playersErr.message}` };
    }

    revalidatePath("/mi-equipo");
    return { ok: true as const, teamRegistrationId: reg.id };
  } catch (err) {
    // Cleanup general: si algo falló y tenemos IDs creados, borrarlos
    const supabase = (await getSupabaseServer()) as any;
    if (createdTeamRegistrationId) {
      await supabase.from("team_registration").delete().eq("id", createdTeamRegistrationId);
    }
    if (createdTeamAccountId) {
      await supabase.from("team_account").delete().eq("id", createdTeamAccountId);
    }
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}
