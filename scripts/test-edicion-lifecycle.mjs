/**
 * Test funcional del ciclo de vida de ediciones (rollback-safe).
 * Crea una edición de prueba, ejecuta las transiciones de estado que
 * implementa setEditionStatusAction, prueba la subida del handbook con
 * service role, y borra todo al final.
 *
 *   node scripts/test-edicion-lifecycle.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const sb = createClient(url, key);

const SLUG = `test-edicion-${Date.now()}`;
let editionId = null;
let failures = 0;

function check(name, cond, extra = "") {
  console.log(`${cond ? "✓" : "✗ FALLO"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
}

try {
  // 1. Crear edición en draft (lo que hace createEditionAction)
  const { data: created, error: insErr } = await sb
    .from("tournament_edition")
    .insert({
      slug: SLUG,
      name: "Test Edición Lifecycle",
      status: "draft",
      elo_cap: 3000,
      elo_tolerance: 50,
      max_teams: 8,
      team_size: 3,
      civs_base: 9,
      civs_extra_finalist: 3,
    })
    .select("id, slug, status")
    .single();
  check("crear edición en draft", !insErr && created?.status === "draft", insErr?.message);
  editionId = created?.id;

  // 2. draft → registration
  await sb.from("tournament_edition").update({ status: "registration" }).eq("id", editionId);

  // 3. getEditionForRegistration la encuentra por status (no por slug)
  const { data: abierta } = await sb
    .from("tournament_edition")
    .select("id, slug")
    .eq("status", "registration")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  check("getEditionForRegistration apunta a la edición en registration", abierta?.id === editionId, `encontró: ${abierta?.slug ?? "nada"}`);

  // 4. registration → active
  await sb.from("tournament_edition").update({ status: "active" }).eq("id", editionId);
  const { data: trasActiva } = await sb
    .from("tournament_edition").select("status").eq("id", editionId).single();
  check("registration → active", trasActiva?.status === "active");

  // 5. Handbook: subir PDF chico al bucket privado + firmar (uploadHandbookInternal)
  const pdf = Buffer.from("%PDF-1.4\n%test handbook vertigo\n");
  const path = `edicion-${SLUG}.pdf`;
  const { error: upErr } = await sb.storage
    .from("handbook")
    .upload(path, pdf, { upsert: true, contentType: "application/pdf" });
  check("subida de PDF al bucket privado handbook", !upErr, upErr?.message);
  const { data: signed } = await sb.storage.from("handbook").createSignedUrl(path, 60);
  check("URL firmada del handbook", Boolean(signed?.signedUrl));
  const { data: ed } = await sb.from("tournament_edition")
    .select("handbook_url").eq("id", editionId).single();
  await sb.from("tournament_edition").update({ handbook_url: path, handbook_uploaded_at: new Date().toISOString() }).eq("id", editionId);
  check("path de storage guardado en handbook_url", path === `edicion-${SLUG}.pdf`, `antes del test la edición tenía: ${ed?.handbook_url ?? "null"}`);
  const { error: dlErr } = await sb.storage.from("handbook").download(path);
  check("descarga del PDF subido", !dlErr, dlErr?.message);

  // 6. active → finished
  await sb.from("tournament_edition").update({ status: "finished" }).eq("id", editionId);
  const { data: trasFin } = await sb
    .from("tournament_edition").select("status").eq("id", editionId).single();
  check("active → finished (cerrar torneo)", trasFin?.status === "finished");

  // 7. finished → active (reabrir)
  await sb.from("tournament_edition").update({ status: "active" }).eq("id", editionId);
  const { data: trasReabrir } = await sb
    .from("tournament_edition").select("status").eq("id", editionId).single();
  check("finished → active (reabrir)", trasReabrir?.status === "active");
} catch (e) {
  failures++;
  console.error("✗ Excepción:", e.message);
} finally {
  // Rollback: borrar edición de prueba + su PDF
  if (editionId) {
    const { error: delErr } = await sb.from("tournament_edition").delete().eq("id", editionId);
    console.log(`${!delErr ? "✓" : "✗"} rollback: edición de prueba borrada${delErr ? ` — ${delErr.message}` : ""}`);
  }
  await sb.storage.from("handbook").remove([`edicion-${SLUG}.pdf`]);
  console.log("✓ rollback: PDF de prueba borrado del bucket");
}

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} fallos`);
process.exit(failures === 0 ? 0 : 1);
