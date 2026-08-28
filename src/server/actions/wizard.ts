"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { GENERIC_AVATARS } from "@/lib/constants";
import { validateTeamEloCap } from "@/lib/aoe2";
import { getEditionForRegistration } from "@/lib/edition";
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
// Reanudación del wizard — si ya estás logueado con reino o inscripción,
// no te hacemos repetir todo: se precargan datos y se reutiliza el reino.
// ============================================================

export async function getWizardResume() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authenticated: false as const };

  const service = getSupabaseServiceRole() as any;
  const { data: accountRow } = await service
    .from("account")
    .select("id")
    .eq("supabase_auth_id", user.id)
    .maybeSingle();
  if (!accountRow) {
    return { authenticated: true as const, email: user.email ?? "", hasOpenRegistration: false as const, existingTeam: null };
  }

  const { data: teams } = await service
    .from("team_account")
    .select("id, name, tagline, emblem_id")
    .eq("owner_id", accountRow.id)
    .order("created_at", { ascending: true });
  const teamIds = (teams ?? []).map((t: any) => t.id);

  let hasOpenRegistration = false;
  if (teamIds.length > 0) {
    const edition = await getEditionForRegistration(service);
    if (edition) {
      const { data: reg } = await service
        .from("team_registration")
        .select("id")
        .eq("tournament_edition_id", edition.id)
        .in("team_account_id", teamIds)
        // Solo pending/approved cuentan como "ya inscripto": un equipo rechazado
        // por no pagar en 72hs (payment_timeout) puede re-inscribirse si queda
        // lugar. El rechazo manual del admin sí bloquea (anti-smurf).
        .in("status", ["pending", "approved"])
        .maybeSingle();
      hasOpenRegistration = !!reg;
    }
  }

  const first = (teams ?? [])[0] ?? null;
  return {
    authenticated: true as const,
    email: user.email ?? "",
    hasOpenRegistration,
    existingTeam: first
      ? {
          id: first.id as string,
          name: first.name as string,
          tagline: (first.tagline ?? "") as string,
          emblemId: (first.emblem_id ?? null) as string | null,
        }
      : null,
  };
}

// ============================================================
// Waitlist de cupo — "avisame si se libera un lugar"
// Cuando el freno muestra cupo completo, el mail queda anotado
// en cupo_waitlist (migración 0013) asociado a la edición.
// ============================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function joinCupoWaitlist(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false as const, error: "Ingresá un email válido." };
  }

  try {
    const service = getSupabaseServiceRole() as any;
    const edition = await getEditionForRegistration(service);
    if (!edition) {
      return { ok: false as const, error: "No hay ninguna edición con inscripciones abiertas." };
    }

    // Solo tiene sentido anotarse si el cupo está lleno; si hay lugar, mejor inscribirse.
    const maxTeams = edition.max_teams ?? 32;
    const { count } = await service
      .from("team_registration")
      .select("id", { count: "exact", head: true })
      .eq("tournament_edition_id", edition.id)
      .in("status", ["approved", "pending"]);
    if ((count ?? 0) < maxTeams) {
      return { ok: false as const, error: "¡Hay lugares disponibles! Inscribite desde el wizard." };
    }

    // Upsert idempotente: anotarse dos veces no duplica ni falla.
    const { error } = await service
      .from("cupo_waitlist")
      .upsert(
        { tournament_edition_id: edition.id, email, source: "wizard_freno" },
        { onConflict: "tournament_edition_id,email" }
      );
    if (error) return { ok: false as const, error: "No pudimos anotarte ahora. Intentá de nuevo en un rato." };
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "No pudimos anotarte ahora. Intentá de nuevo en un rato." };
  }
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

    // 2. Buscar la edición con inscripciones abiertas (la abre el admin desde
    //    /admin/torneo — no hay slug hardcodeado: cada edición nueva la recibe).
    const edition = await getEditionForRegistration(supabase);
    if (!edition) {
      return { ok: false as const, error: "No hay ninguna edición con inscripciones abiertas." };
    }

    // 2b. Control de cupo: bloquear la inscripción si ya se alcanzó max_teams.
    //     Contamos las inscripciones no rechazadas (aprobadas + pendientes) con
    //     service role (el cliente de usuario puede no tener lectura por RLS).
    //     Sin este check el wizard seguía aceptando equipos con el torneo lleno.
    const maxTeams = edition.max_teams ?? 32;
    const service = getSupabaseServiceRole() as any;
    const { count: regCount } = await service
      .from("team_registration")
      .select("id", { count: "exact", head: true })
      .eq("tournament_edition_id", edition.id)
      .in("status", ["approved", "pending"]);
    if ((regCount ?? 0) >= maxTeams) {
      return { ok: false as const, error: "El torneo ya alcanzó el cupo máximo de equipos. Las inscripciones están cerradas." };
    }

    // 2c. Anti doble inscripción: si este capitán ya tiene un equipo inscripto
    //     en esta edición, bloquear. (Cada submit crea un team_account nuevo,
    //     así que la unique constraint por team_account nunca lo frenaba.)
    const { data: myTeams } = await service
      .from("team_account")
      .select("id")
      .eq("owner_id", accountId);
    const myTeamIds = (myTeams ?? []).map((t: any) => t.id);
    if (myTeamIds.length > 0) {
      const { data: existingReg } = await service
        .from("team_registration")
        .select("id")
        .eq("tournament_edition_id", edition.id)
        .in("team_account_id", myTeamIds)
        // Ídem resume: solo pending/approved bloquean; payment_timeout puede volver.
        .in("status", ["pending", "approved"])
        .maybeSingle();
      if (existingReg) {
        return { ok: false as const, error: "Ya tenés un equipo inscripto en esta edición. Revisá /mi-equipo." };
      }
    }

    // 2d. Unicidad de nombre + reutilización de reino: si el nombre coincide con
    //     un equipo del PROPIO usuario, se reutiliza ese team_account (update) en
    //     vez de duplicar reinos ni rechazar el submit. Si es de otro dueño, error.
    const { data: nameClash } = await service
      .from("team_account")
      .select("id, name")
      .ilike("name", data.teamName.trim())
      .maybeSingle();
    if (nameClash && !myTeamIds.includes(nameClash.id)) {
      return { ok: false as const, error: `Ya existe un equipo llamado "${nameClash.name}". Elegí otro nombre.` };
    }
    const reuseTeamId: string | null = nameClash ? nameClash.id : null;

    // 3. Validar que los 3 aoe2ProfileId sean distintos
    const profileIds = data.players.map((p) => p.aoe2ProfileId).filter((id): id is number => id != null);
    if (profileIds.length !== 3) {
      return { ok: false as const, error: "Los 3 jugadores deben tener perfil de AoE2 Companion cargado." };
    }
    const uniqueProfileIds = new Set(profileIds);
    if (uniqueProfileIds.size !== 3) {
      return { ok: false as const, error: "Los 3 jugadores deben tener perfiles de AoE2 Companion distintos. No podés cargar el mismo jugador dos veces." };
    }

    // 3a. Anti duplicación entre equipos: ningún jugador puede estar inscripto
    //     en dos equipos distintos de la misma edición. La unique constraint
    //     (team_registration_id, aoe2_profile_id) solo frena duplicados DENTRO
    //     de un equipo, no entre equipos.
    const { data: editionRegs } = await service
      .from("team_registration")
      .select("id")
      .eq("tournament_edition_id", edition.id)
      .in("status", ["approved", "pending"]);
    const editionRegIds = (editionRegs ?? []).map((r: any) => r.id);
    if (editionRegIds.length > 0) {
      const { data: dupPlayers } = await service
        .from("player_registration")
        .select("aoe2_profile_id, display_name")
        .in("aoe2_profile_id", profileIds)
        .in("team_registration_id", editionRegIds);
      if (dupPlayers && dupPlayers.length > 0) {
        const names = [...new Set(dupPlayers.map((p: any) => `${p.display_name} (#${p.aoe2_profile_id})`))].join(", ");
        return { ok: false as const, error: `Estos jugadores ya están inscriptos en otro equipo de esta edición: ${names}.` };
      }
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

    // 6. Reino: reutilizar el team_account existente si el nombre coincide
    //    (update — nunca duplicar reinos), o crear uno nuevo.
    let team: { id: string };
    if (reuseTeamId) {
      const { data: updated, error: upErr } = await supabase
        .from("team_account")
        .update({
          name: data.teamName,
          tagline: data.teamTagline || null,
          emblem_id: data.emblemId,
        })
        .eq("id", reuseTeamId)
        .select("id")
        .single();
      if (upErr || !updated) return { ok: false as const, error: `Error actualizando tu reino: ${upErr?.message ?? "desconocido"}` };
      team = updated;
      // OJO: reuseTeamId NO se marca como creado — si algo falla después,
      // el cleanup NO debe borrar el reino preexistente del usuario.
    } else {
      const { data: insertedTeam, error: teamErr } = await supabase
        .from("team_account")
        .insert({
          owner_id: accountId,
          name: data.teamName,
          tagline: data.teamTagline || null,
          emblem_id: data.emblemId, // ← fix bug #10: antes era null
        })
        .select("id")
        .single();
      if (teamErr || !insertedTeam) return { ok: false as const, error: `Error creando equipo: ${teamErr?.message ?? "desconocido"}` };
      team = insertedTeam;
      createdTeamAccountId = team.id; // solo se limpia si lo creamos acá
    }

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
      // Cleanup: borrar SOLO el team_account si lo creamos en este submit
      if (createdTeamAccountId) {
        await supabase.from("team_account").delete().eq("id", createdTeamAccountId);
        createdTeamAccountId = null;
      }
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
      // Cleanup: borrar lo creado en este submit (jamás un reino reutilizado)
      await supabase.from("team_registration").delete().eq("id", reg.id);
      if (createdTeamAccountId) {
        await supabase.from("team_account").delete().eq("id", createdTeamAccountId);
      }
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
