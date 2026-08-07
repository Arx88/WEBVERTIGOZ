"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { account, teamAccount, teamRegistration, playerRegistration, emblem } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { GENERIC_AVATARS } from "@/lib/constants";
import type { WizardData } from "@/components/wizard/wizard-context";

// ============================================================
// Auth: crear cuenta o loguear
// ============================================================

export async function signUpOrLogin(data: WizardData) {
  const supabase = await getSupabaseServer();

  if (data.existingAccount) {
    const { data: result, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, user: result.user };
  } else {
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          role: "owner",
          team_name: data.teamName,
        },
      },
    });
    if (error) {
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, user: result.user };
  }
}

// ============================================================
// Submit del wizard completo
// ============================================================

export async function submitWizard(data: WizardData) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false as const, error: "No autenticado. Hacé login primero." };
    }

    const db = getDb();

    // 1. Buscar o crear account
    const [accountRow] = await db
      .select()
      .from(account)
      .where(eq(account.supabaseAuthId, user.id))
      .limit(1);

    let accountId: string;

    if (!accountRow) {
      const [newAccount] = await db
        .insert(account)
        .values({
          supabaseAuthId: user.id,
          email: user.email!,
          role: "owner",
          avatarKey: GENERIC_AVATARS[Math.floor(Math.random() * GENERIC_AVATARS.length)],
          displayName: data.teamName,
        })
        .returning();
      accountId = newAccount.id;
    } else {
      accountId = accountRow.id;
      if (accountRow.role !== "owner") {
        await db
          .update(account)
          .set({ role: "owner", displayName: data.teamName })
          .where(eq(account.id, accountId));
      }
    }

    // 2. Buscar edition activa
    const editionSlug = "vertigo-2026-1";
    const { data: editionDataRaw, error: editionErr } = await supabase
      .from("tournament_edition")
      .select("id, civs_base, civs_extra_finalist, elo_cap, elo_tolerance")
      .eq("slug", editionSlug)
      .single();

    if (editionErr || !editionDataRaw) {
      return {
        ok: false as const,
        error: "No se encontró la edición del torneo. Contactá al staff.",
      };
    }

    const editionData = editionDataRaw as {
      id: string;
      civs_base: number | null;
      civs_extra_finalist: number | null;
      elo_cap: number | null;
      elo_tolerance: number | null;
    };

    // 3. Crear o actualizar team_account
    const [existingTeam] = await db
      .select()
      .from(teamAccount)
      .where(eq(teamAccount.ownerId, accountId))
      .limit(1);

    let teamAccountId: string;

    if (existingTeam) {
      const [updated] = await db
        .update(teamAccount)
        .set({
          name: data.teamName,
          tagline: data.teamTagline || null,
          emblemId: data.emblemId || null,
        })
        .where(eq(teamAccount.id, existingTeam.id))
        .returning();
      teamAccountId = updated.id;
    } else {
      const [newTeam] = await db
        .insert(teamAccount)
        .values({
          ownerId: accountId,
          name: data.teamName,
          tagline: data.teamTagline || null,
          emblemId: data.emblemId || null,
        })
        .returning();
      teamAccountId = newTeam.id;
    }

    // 4. Verificar que no exista ya una registration
    const [existingReg] = await db
      .select()
      .from(teamRegistration)
      .where(
        and(
          eq(teamRegistration.teamAccountId, teamAccountId),
          eq(teamRegistration.tournamentEditionId, editionData.id)
        )
      )
      .limit(1);

    if (existingReg) {
      return {
        ok: false as const,
        error: "Tu equipo ya está inscripto en esta edición.",
      };
    }

    // 5. Validar ELO cap
    const totalElo = data.players.reduce(
      (sum, p) => sum + (p.maxRatingRm1v1 ?? 0),
      0
    );
    const eloMax = (editionData.elo_cap ?? 3500) + (editionData.elo_tolerance ?? 20);
    if (totalElo > eloMax) {
      return {
        ok: false as const,
        error: `El ELO total (${totalElo}) excede el máximo permitido (${eloMax}).`,
      };
    }

    // 6. Validar civs
    const expectedCivsBase = editionData.civs_base ?? 9;
    const expectedCivsExtra = editionData.civs_extra_finalist ?? 3;
    if (data.baseCivIds.length !== expectedCivsBase) {
      return { ok: false as const, error: `Debes elegir ${expectedCivsBase} civs base.` };
    }
    if (data.extraCivIds.length !== expectedCivsExtra) {
      return { ok: false as const, error: `Debes elegir ${expectedCivsExtra} civs extra.` };
    }
    const allCivs = [...data.baseCivIds, ...data.extraCivIds];
    const uniqueCivs = new Set(allCivs);
    if (uniqueCivs.size !== allCivs.length) {
      return {
        ok: false as const,
        error: "Hay civs duplicadas. Las civs extra no pueden repetir con las base.",
      };
    }

    // 7. Validaciones finales
    if (!data.handbookDownloadedAt) {
      return { ok: false as const, error: "Debes descargar el handbook antes de continuar." };
    }
    if (!data.restreamAccepted || !data.termsAcceptedAt) {
      return { ok: false as const, error: "Debes aceptar los términos." };
    }
    const captains = data.players.filter((p) => p.isCaptain);
    if (captains.length !== 1) {
      return { ok: false as const, error: "Debe haber exactamente 1 capitán." };
    }

    // 8. Crear team_registration
    const [reg] = await db
      .insert(teamRegistration)
      .values({
        teamAccountId,
        tournamentEditionId: editionData.id,
        baseCivIds: data.baseCivIds,
        extraCivIds: data.extraCivIds,
        eloFreezeSnapshot: totalElo,
        eloVerificationStatus: data.players.some((p) => p.verificationStatus === "hidden")
          ? "pending"
          : data.players.every((p) => p.verificationStatus === "verified")
          ? "verified"
          : "pending",
        restreamAccepted: data.restreamAccepted,
        handbookDownloadedAt: data.handbookDownloadedAt,
        termsAcceptedAt: data.termsAcceptedAt,
        submittedAt: new Date(),
        status: "pending",
      })
      .returning();

    // 9. Insertar jugadores
    await db.insert(playerRegistration).values(
      data.players.map((p) => ({
        teamRegistrationId: reg.id,
        aoe2ProfileId: p.aoe2ProfileId!,
        aoe2SteamId: p.steamId || null,
        displayName: p.displayName,
        country: p.country || null,
        clan: p.clan || null,
        platform: null,
        isVerified: p.isVerified,
        maxRatingRm1v1: p.maxRatingRm1v1 ?? null,
        ratingRm1v1Current: p.ratingRm1v1Current ?? null,
        ratingRm1v1Rank: p.ratingRm1v1Rank ?? null,
        isCaptain: p.isCaptain,
        linkedProfiles: [],
        verificationPayload: null,
      }))
    );

    // comodin_inventory se crea automáticamente por trigger

    revalidatePath("/mi-equipo");
    return { ok: true as const, teamRegistrationId: reg.id };
  } catch (err) {
    console.error("[submitWizard] error:", err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Error desconocido al inscribir",
    };
  }
}
