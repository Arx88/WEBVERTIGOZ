// Genera una sesión de Supabase para un capitán real vía admin API (sin tocar su password).
import { readFileSync, writeFileSync } from "node:fs";
const email = process.argv[2] ?? "damianemponce@gmail.com";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const gl = await fetch(`${URL_}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email }),
});
const glj = await gl.json();
const tokenHash = glj.hashed_token ?? glj.properties?.token_hash;
const otp = glj.email_otp ?? glj.properties?.token;
if (!tokenHash && !otp) { console.error("sin token:", Object.keys(glj).join(",")); setTimeout(()=>process.exit(1), 100); }
const ver = await fetch(`${URL_}/auth/v1/verify`, {
  method: "POST",
  headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify(tokenHash ? { type: "magiclink", token_hash: tokenHash } : { type: "magiclink", token: otp }),
});
if (!ver.ok) { console.error("verify", ver.status, await ver.text()); setTimeout(()=>process.exit(1),100); }
const v = await ver.json();
const cookiePayload = {
  access_token: v.access_token, token_type: v.token_type, expires_in: v.expires_in,
  expires_at: v.expires_at, refresh_token: v.refresh_token, user: v.user,
};
writeFileSync(".e2e-audit/states/captain-live-cookie.txt",
  "base64-" + Buffer.from(JSON.stringify(cookiePayload)).toString("base64"));
console.log("OK user:", v.user?.email, "exp:", new Date(v.expires_at * 1000).toISOString());
setTimeout(() => process.exit(0), 100);
