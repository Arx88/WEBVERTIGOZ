/**
 * VÉRTIGO Cup — Envío de emails.
 *
 * Proveedor activo: GMAIL SMTP (sin dominio propio: manda desde el gmail del
 * staff a CUALQUIER destinatario). Config en .env.local:
 *   GMAIL_USER            → ej: vertigocupaoe2@gmail.com
 *   GMAIL_APP_PASSWORD    → contraseña de aplicación de 16 letras
 *                           (myaccount.google.com/apppasswords — exige tener
 *                           activada la verificación en 2 pasos de Google)
 *
 * Fallback: RESEND (requiere dominio verificado para enviar a terceros).
 *   RESEND_API_KEY / EMAIL_FROM
 *
 * Si no hay ninguno configurado, los envíos se saltean con un warning y la
 * app sigue funcionando: la waitlist NO se marca como notificada para que la
 * próxima corrida la reintente.
 */
import nodemailer from "nodemailer";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || !!process.env.RESEND_API_KEY;
}

/** Transporte SMTP de Gmail (conexión segura 465, reutilizada entre envíos). */
let gmailTransport: nodemailer.Transporter | null = null;
function getGmailTransport(): nodemailer.Transporter {
  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, ""),
      },
    });
  }
  return gmailTransport;
}

async function sendViaGmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  try {
    await getGmailTransport().sendMail({
      from: `"VÉRTIGO Cup" <${process.env.GMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (e) {
    console.error(`[email] Gmail SMTP falló enviando a ${opts.to}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

async function sendViaResend(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.EMAIL_FROM ?? "VÉRTIGO Cup <onboarding@resend.dev>";
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      console.error(`[email] Resend ${res.status}:`, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] error de red enviando a", opts.to, ":", e);
    return false;
  }
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  // Prioridad: Gmail SMTP (anda sin dominio) → Resend → skip con warning.
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return sendViaGmail(opts);
  }
  if (process.env.RESEND_API_KEY) {
    const ok = await sendViaResend(opts);
    if (ok) return true;
    // Resend configurado pero falló (ej. 403 test-sender): probar Gmail si
    // hubiera user sin password completa no aplica — avisar y salir.
  }
  console.warn(`[email] sin proveedor configurado — no se envió "${opts.subject}" a ${opts.to}`);
  return false;
}

/** Wrapper HTML con la identidad del sitio (dark + púrpura, estilos inline). */
export function emailShell(title: string, bodyHtml: string, cta?: { href: string; label: string }): string {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#070310;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:3px;color:#f2eef7;text-transform:uppercase;">VÉRTIGO <span style="color:#a78bfa;">CUP</span></div>
      <div style="font-size:10px;letter-spacing:5px;color:#7c3aed;margin-top:4px;">AGE OF EMPIRES II</div>
    </div>
    <div style="background:#0d0913;border:1px solid #231a2e;border-radius:14px;padding:30px 28px;">
      <h1 style="margin:0 0 14px;font-size:19px;letter-spacing:1px;color:#f2eef7;text-transform:uppercase;font-family:Georgia,serif;">${title}</h1>
      <div style="font-size:14px;line-height:1.65;color:#b7aec9;">${bodyHtml}</div>
      ${cta ? `<div style="text-align:center;margin-top:26px;"><a href="${cta.href}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:14px 30px;border-radius:9px;">${cta.label}</a></div>` : ""}
    </div>
    <div style="text-align:center;margin-top:22px;font-size:11px;color:#5f5870;">
      ${siteUrl ? `<a href="${siteUrl}" style="color:#9a92a6;">${siteUrl.replace(/^https?:\/\//, "")}</a> · ` : ""}Este mail es de la organización de la VÉRTIGO Cup.
    </div>
  </div>
</body></html>`;
}
