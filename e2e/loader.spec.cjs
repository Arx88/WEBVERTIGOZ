// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * E2E: el fondo WebGL del loader debe sobrevivir a pérdida de contexto
 * mid-session y a la indisponibilidad total de WebGL (fallback CSS),
 * y la landing NO debe caer en el error boundary cuando WebGL no existe.
 *
 * Se ejercita el PageLoader directo vía la ruta de QA /loader-test
 * (harness que mantiene el loader firme con cycles=0).
 */

/** ¿Algún canvas del loader tiene contexto WebGL vivo? (el watchdog puede
 *  reemplazar el canvas original: oculta el viejo y agrega uno nuevo). */
function anyLiveCanvas() {
  const els = Array.from(document.querySelectorAll(".stream-convergence-bg canvas"));
  for (const el of els) {
    const gl = el.getContext("webgl") || el.getContext("experimental-webgl");
    if (gl && !gl.isContextLost()) return true;
  }
  return false;
}

/** ¿Algún canvas del loader dibujó píxeles no negros? */
function anyCanvasPainted() {
  const els = Array.from(document.querySelectorAll(".stream-convergence-bg canvas"));
  for (const el of els) {
    const gl = el.getContext("webgl") || el.getContext("experimental-webgl");
    if (!gl || gl.isContextLost()) continue;
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext("2d");
    if (!ctx) continue;
    try {
      ctx.drawImage(el, 0, 0, 8, 8);
      const data = ctx.getImageData(0, 0, 8, 8).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] + data[i + 1] + data[i + 2] > 12) return true;
      }
    } catch {
      // drawImage antes del primer frame: ignorar y probar el siguiente
    }
  }
  return false;
}

test.describe("WebGL loader reliability", () => {
  test("el loader sobrevive a la pérdida de contexto (restore + re-init)", async ({ page }) => {
    await page.goto("/loader-test?cycles=0&hold=1");
    // cycles=0 mantiene el loader firme. El contexto puede arrancar perdido
    // (StrictMode) y el watchdog lo revive o reemplaza el canvas: esperamos
    // a que ALGÚN canvas del loader tenga contexto vivo.
    await page.waitForFunction(anyLiveCanvas, undefined, { timeout: 20_000 });

    // Forzar la pérdida en TODOS los canvas vivos (simula la caída de la GPU
    // mid-session; el watchdog puede tener un canvas propio además del de React).
    const lost = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".stream-convergence-bg canvas"));
      let any = false;
      for (const el of els) {
        const gl = el.getContext("webgl") || el.getContext("experimental-webgl");
        if (gl && !gl.isContextLost()) {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
          any = true;
        }
      }
      return any;
    });
    test.skip(!lost, "WebGL unavailable in this browser");

    // Tras la pérdida el contexto debe volver (restore) o el watchdog
    // reemplazar el canvas: algún canvas del loader vuelve a estar vivo
    // y encima ya dibujó (la pipeline quedó sana de verdad).
    await page.waitForFunction(anyLiveCanvas, undefined, { timeout: 20_000 });
    await page.waitForFunction(anyCanvasPainted, undefined, { timeout: 15_000 });
  });

  test("la landing no crashea cuando WebGL no está disponible", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // eslint-disable-next-line no-restricted-syntax
      HTMLCanvasElement.prototype.getContext = function patched(type, ...args) {
        if (String(type).includes("webgl")) return null;
        return orig.apply(this, [type, ...args]);
      };
    });
    await page.goto("/");
    // La página debe cargar completa, sin el error boundary del sitio.
    await expect(page.locator(".vertigo-state-screen")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator("main")).toBeVisible();
  });

  test("el loader cae al gradiente CSS cuando WebGL es inaccesible", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // eslint-disable-next-line no-restricted-syntax
      HTMLCanvasElement.prototype.getContext = function patched(type, ...args) {
        if (String(type).includes("webgl")) return null;
        return orig.apply(this, [type, ...args]);
      };
    });
    await page.goto("/loader-test?cycles=0&hold=1");
    // Sin WebGL el loader igual debe estar presente (respaldo CSS).
    await expect(page.locator(".vertigo-loader")).toBeVisible({ timeout: 20_000 });
    // Y ningún error boundary.
    await expect(page.locator(".vertigo-state-screen")).toHaveCount(0);
  });
});
