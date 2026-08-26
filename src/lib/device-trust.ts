/**
 * Dispositivos confiables — acceso rápido de UN clic en /login.
 *
 * Al iniciar sesión se genera un token aleatorio que vive SOLO en una
 * cookie httpOnly de este navegador; en la tabla trusted_device se guarda
 * únicamente su SHA-256 (nunca la contraseña). Al volver a /login, tocar
 * una cuenta recordada restaura la sesión sin escribir nada, usando un
 * magic link generado server-side con el service role.
 */
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";

const COOKIE_NAME = "vc_devices";
const MAX_DEVICES = 3;
const EXPIRY_DAYS = 30;

type DeviceEntry = { e: string; t: string };

export type TrustedDevice = {
  email: string;
  displayName: string | null;
  role: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAgeSeconds ? { maxAge: maxAgeSeconds } : {}),
  } as const;
}

async function readEntries(): Promise<DeviceEntry[]> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (x): x is DeviceEntry =>
        x && typeof x.e === "string" && typeof x.t === "string",
    );
  } catch {
    return [];
  }
}

/** Destino por rol (misma regla que /login y el login form). */
export function homeForRole(role?: string | null) {
  if (role === "spectator") return "/apuestas";
  if (role === "caster") return "/casters";
  return "/mi-equipo";
}

/**
 * Crea (o renueva) el dispositivo confiable para la sesión actual.
 * Llamar SIEMPRE después de un login/registro exitoso. Si algo falla,
 * no rompe nada: simplemente no queda cuenta recordada.
 */
export async function ensureDeviceForSession(): Promise<void> {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const admin = getSupabaseServiceRole() as any;
    const { data: account } = await admin
      .from("account")
      .select("id, email")
      .eq("supabase_auth_id", user.id)
      .maybeSingle();
    if (!account?.email) return;

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86400_000).toISOString();
    const { error } = await admin.from("trusted_device").insert({
      account_id: account.id,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    });
    if (error) return;

    const rest = (await readEntries()).filter(
      (x) => x.e.toLowerCase() !== account.email.toLowerCase(),
    );
    const next = [{ e: account.email as string, t: token }, ...rest].slice(0, MAX_DEVICES);
    const store = await cookies();
    store.set(COOKIE_NAME, JSON.stringify(next), cookieOptions(EXPIRY_DAYS * 86400));
  } catch {
    // Tabla puede no existir todavía u otro fallo: el acceso rápido queda
    // desactivado pero el flujo de login sigue funcionando normal.
  }
}

/**
 * Cuentas recordadas en este navegador, válidas y no expiradas.
 * Los nombres vienen de la BD (join con account), no de localStorage.
 */
export async function listTrustedDevices(): Promise<TrustedDevice[]> {
  try {
    const entries = await readEntries();
    if (!entries.length) return [];

    const admin = getSupabaseServiceRole() as any;
    const hashes = entries.map((x) => hashToken(x.t));
    const { data: rows } = await admin
      .from("trusted_device")
      .select("token_hash, account:account_id(email, display_name, role)")
      .in("token_hash", hashes)
      .gt("expires_at", new Date().toISOString());
    if (!rows?.length) return [];

    const byHash = new Map<string, any>(
      rows.map((r: any) => [r.token_hash as string, r]),
    );
    const seen = new Set<string>();
    const out: TrustedDevice[] = [];
    for (const entry of entries) {
      const row = byHash.get(hashToken(entry.t));
      const acc = row?.account;
      if (!acc?.email) continue;
      const key = acc.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ email: acc.email, displayName: acc.display_name, role: acc.role ?? "" });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Restaura la sesión de Supabase para una cuenta recordada, SIN contraseña:
 * magic link generado con service role + verificación OTP server-side
 * (el cliente @supabase/ssr deja las cookies de sesión listas).
 */
export async function restoreDeviceSession(
  email: string,
): Promise<{ ok: boolean; role?: string }> {
  try {
    const entries = await readEntries();
    const entry = entries.find((x) => x.e.toLowerCase() === email.toLowerCase());
    if (!entry) return { ok: false };

    const admin = getSupabaseServiceRole() as any;
    const { data: row } = await admin
      .from("trusted_device")
      .select("id, account:account_id(id, email, role)")
      .eq("token_hash", hashToken(entry.t))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    const acc = row?.account;
    if (!acc?.email || acc.email.toLowerCase() !== email.toLowerCase()) {
      return { ok: false };
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: acc.email,
    });
    if (linkErr || !link?.properties) {
      console.error("[device-trust] generateLink falló:", linkErr?.message ?? "sin properties");
      return { ok: false };
    }

    // hashed_token directo, o parseado del action_link como respaldo
    let tokenHash: string | undefined = link.properties.hashed_token;
    if (!tokenHash && link.properties.action_link) {
      try {
        tokenHash =
          new URL(link.properties.action_link).searchParams.get("token") ?? undefined;
      } catch {
        /* noop */
      }
    }
    if (!tokenHash) {
      console.error("[device-trust] generateLink no devolvió token");
      return { ok: false };
    }

    const supabase = await getSupabaseServer();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (verifyErr) {
      console.error("[device-trust] verifyOtp falló:", verifyErr.message);
      return { ok: false };
    }

    await admin
      .from("trusted_device")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true, role: acc.role };
  } catch (err) {
    console.error("[device-trust] restore error:", err);
    return { ok: false };
  }
}

/** Olvida una cuenta recordada: borra el token de la BD y de la cookie. */
export async function forgetDevice(email: string): Promise<void> {
  try {
    const entries = await readEntries();
    const entry = entries.find((x) => x.e.toLowerCase() === email.toLowerCase());
    if (!entry) return;

    const admin = getSupabaseServiceRole() as any;
    await admin.from("trusted_device").delete().eq("token_hash", hashToken(entry.t));

    const next = entries.filter((x) => x.e.toLowerCase() !== email.toLowerCase());
    const store = await cookies();
    if (next.length) {
      store.set(COOKIE_NAME, JSON.stringify(next), cookieOptions(EXPIRY_DAYS * 86400));
    } else {
      store.delete(COOKIE_NAME);
    }
  } catch {
    /* noop */
  }
}
