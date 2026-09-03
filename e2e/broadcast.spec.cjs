// @ts-check
// Nota: este repo instala `playwright` (no @playwright/test): el runner vive
// en el subpath playwright/test.
const { test, expect } = require("playwright/test");
const { seedTrustedDevice, cleanupSeededDevices } = require("./helpers/device-trust.mjs");

/**
 * E2E de los flujos críticos (sin tocar datos de negocio):
 *  1. Landing: renderiza, el video de la ruleta NO descarga bytes hasta que
 *     la sección entra en viewport (lazy), páginas públicas sin 500.
 *  2. Admin broadcast (logueado como super admin del seed):
 *     - el composer refleja lo escrito en el espejo de la campana,
 *     - el botón se habilita, el modal de confirmación muestra el resumen,
 *     - Escape lo cierra sin enviar nada.
 *  3. API: /api/cron/scheduled-broadcasts responde con contrato JSON.
 *
 * Login admin por formulario con la cuenta E2E canónica (creada por la
 * auditoría previa, .e2e-audit/04-admin.mjs) — login REAL de Supabase, sin
 * depender del device-trust ni de cookies preexistentes.
 */

const ADMIN_EMAIL = "e2e-admin@vertigoaudit.test";
const ADMIN_PASS = "E2eAdmin2026!";

test.describe.configure({ mode: "serial" });

async function loginAdmin(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const email = page.locator('#email, input[type="email"], input[name="email"]').first();
  const pass = page.locator('#password, input[type="password"], input[name="password"]').first();
  if (!(await email.count()) || !(await pass.count())) return false;
  await email.fill(ADMIN_EMAIL);
  await pass.fill(ADMIN_PASS);
  await page.locator('button[type="submit"]').click();
  // 60s: el primer login compila bundles del server (cold dev) y puede tardar
  await page.waitForURL(/\/admin/, { timeout: 60_000 });
  return true;
}

test.describe("Público — carga y lazy video", () => {
  test("la landing renderiza y la ruleta no descarga video antes del viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("civ-section")).toBeVisible();

    // Estado inicial: el video de la ruleta (preload=none) no descargó bytes
    const buffered = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="roulette-video"]');
      return v ? v.buffered.length : -1;
    });
    expect(buffered).toBe(0);

    // ...pero al scrollear hasta la sección, el video arranca
    await page.getByTestId("civ-section").scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => {
        const v = document.querySelector('[data-testid="roulette-video"]');
        return v && !v.paused && v.buffered.length > 0;
      },
      { timeout: 10_000 }
    );
  });

  test("fixture, bracket, casters y equipos cargan sin error 500", async ({ page }) => {
    for (const path of ["/fixture", "/bracket", "/casters", "/equipos"]) {
      const resp = await page.goto(path);
      expect(resp.status(), path).toBeLessThan(500);
      await expect(page.locator("main")).toBeVisible();
    }
  });
});

test.describe("Admin — panel de notificaciones (rediseño)", () => {
  test("composer refleja en el espejo y el modal confirma antes de enviar", async ({ page }) => {
    const ok = await loginAdmin(page);
    if (!ok) test.skip(true, "No se pudo loguear como admin en este entorno");
    await page.goto("/admin/notificaciones");

    // Hero: el espejo existe y el estado inicial es coherente
    const mirror = page.locator(".bcast-bell-mirror");
    await expect(mirror).toBeVisible();
    await expect(mirror).toContainText("Título del aviso…");

    // Escribir: el espejo refleja en vivo, el botón se habilita
    await page.fill("#bcast-title", "Prueba E2E — no enviar");
    await page.fill("#bcast-body", "Este aviso se escribe solo para probar el espejo.");
    await expect(mirror).toContainText("Prueba E2E — no enviar");
    await expect(mirror).toContainText("Este aviso se escribe solo para probar el espejo.");
    await expect(page.getByRole("button", { name: /Enviar aviso/i })).toBeEnabled();

    // El contador de caracteres funciona
    await expect(page.getByText("/160")).toBeVisible();

    // Abrir el modal de confirmación: el resumen está, Escape lo cierra sin enviar
    await page.getByRole("button", { name: /Enviar aviso/i }).click();
    const dialog = page.locator('[role="dialog"][aria-label="Confirmar envío"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Prueba E2E — no enviar");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Nada se envió: la alerta de éxito NO aparece
    await expect(page.locator(".bcast-alert-ok")).toHaveCount(0);
  });

  test("programar sin fecha muestra la validación y no abre el modal", async ({ page }) => {
    const ok = await loginAdmin(page);
    if (!ok) test.skip(true, "No se pudo loguear como admin en este entorno");

    await page.goto("/admin/notificaciones");
    await page.check("#bcast-schedule-toggle");
    await expect(page.getByText("Fecha y hora de envío")).toBeVisible();

    // Con el modo programado activo y sin fecha, el botón pasa a "Agendar aviso"
    await page.fill("#bcast-title", "Aviso programado E2E");
    const agendar = page.getByRole("button", { name: /Agendar aviso/i });
    await expect(agendar).toBeEnabled();

    // Sin fecha elegida: validación inline (nada se agenda ni abre modal)
    await agendar.click();
    await expect(page.locator(".bcast-alert-err")).toContainText("fecha y hora");
    await expect(page.locator('[role="dialog"][aria-label="Confirmar envío"]')).toHaveCount(0);
  });

  test("el cron de avisos programados responde con contrato JSON", async ({ request }) => {
    // En dev sin CRON_SECRET el endpoint responde 200; en producción exige
    // el header (401). En ambos casos el contrato es JSON.
    const resp = await request.get("/api/cron/scheduled-broadcasts");
    expect([200, 401]).toContain(resp.status());
    const data = await resp.json().catch(() => ({}));
    if (resp.status() === 200) {
      expect(data.ok).toBe(true);
      expect(data).toHaveProperty("delivered");
    }
  });
});
