"use client";

/**
 * Alta de caster con preview vivo — sin apretujes.
 * Secciones: Identidad / Canales + mini-preview de /casters.
 * Usa la server action existente (sin cambios de backend).
 */

import { useMemo, useState } from "react";
import { AtSign, Eye, Mic, Twitch, Youtube } from "lucide-react";
import VertigoSelect from "@/components/admin/vertigo-select";
import { createCasterAction } from "@/server/actions/auth";

const cleanHandle = (v: string) =>
  v.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/^twitch\.tv\//, "").replace(/^@/, "").replace(/\s+/g, "");

export default function CasterCreateForm() {
  const [name, setName] = useState("");
  const [tier, setTier] = useState("community");
  const [twitch, setTwitch] = useState("");
  const [youtube, setYoutube] = useState("");
  const [kick, setKick] = useState("");

  const tw = cleanHandle(twitch);
  const yt = cleanHandle(youtube);
  const kk = cleanHandle(kick);
  const hasChannel = !!(tw || yt || kk);

  const tierHint = useMemo(() => {
    if (tier === "official") return "Stream principal · reproductor grande de /casters";
    if (tier === "secondary") return "Co-stream · aparece al lado del principal";
    return "Stream libre · visible en la grilla de comunidad";
  }, [tier]);

  return (
    <div className="caster-side-sticky">
      <div className="vertigo-card caster-form-card">
        <form action={createCasterAction} className="caster-form">
          <section className="caster-sec">
            <header className="caster-sec-head">
              <span className="caster-sec-num">01</span>
              <div><h3>Identidad</h3><p>Cómo se muestra en /casters.</p></div>
            </header>
            <div className="vertigo-field caster-field">
              <label htmlFor="cc-name">Nombre visible *</label>
              <input
                id="cc-name" name="display_name" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: VÉRTIGO Cast" required maxLength={100}
              />
            </div>
            <div className="vertigo-field caster-field" style={{ marginBottom: 0 }}>
              <label htmlFor="cc-tier">Tier inicial</label>
              <VertigoSelect
                name="tier" defaultValue="community"
                options={[
                  { value: "official", label: "Oficial — stream principal" },
                  { value: "secondary", label: "Secundario — co-stream" },
                  { value: "community", label: "Comunidad — stream libre" },
                ]}
                onValueChange={(v) => setTier(v)}
              />
              <p className="vertigo-hint caster-hint">{tierHint}</p>
            </div>
          </section>

          <section className="caster-sec">
            <header className="caster-sec-head">
              <span className="caster-sec-num">02</span>
              <div><h3>Canales</h3><p>Solo el handle — sin URLs. Al menos uno.</p></div>
            </header>
            <div className="vertigo-field caster-field">
              <label htmlFor="cc-twitch"><Twitch size={12} style={{ display: "inline", verticalAlign: -1 }} /> Twitch</label>
              <div className="caster-inrow">
                <input id="cc-twitch" name="twitch_channel" value={twitch} onChange={(e) => setTwitch(e.target.value)} placeholder="vertigoaoe" maxLength={100} />
                {tw && <a className="caster-mini" href={`https://twitch.tv/${tw}`} target="_blank" rel="noreferrer">Abrir</a>}
              </div>
            </div>
            <div className="vertigo-field caster-field">
              <label htmlFor="cc-yt"><Youtube size={12} style={{ display: "inline", verticalAlign: -1 }} /> YouTube</label>
              <div className="caster-inrow">
                <input id="cc-yt" name="youtube_channel" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="@vertigoaoe" maxLength={100} />
                {yt && <a className="caster-mini" href={`https://youtube.com/@${yt.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Abrir</a>}
              </div>
            </div>
            <div className="vertigo-field caster-field" style={{ marginBottom: 0 }}>
              <label htmlFor="cc-kick"><AtSign size={12} style={{ display: "inline", verticalAlign: -1 }} /> Kick</label>
              <input id="cc-kick" name="kick_channel" value={kick} onChange={(e) => setKick(e.target.value)} placeholder="vertigo" maxLength={100} />
            </div>
          </section>

          {/* Preview vivo */}
          <div className="caster-preview" aria-live="polite">
            <span className="caster-preview-tag"><Eye size={11} /> Así se ve en /casters</span>
            <div className="caster-preview-card">
              <span className="caster-preview-avatar">{(name.trim()[0] ?? "V").toUpperCase()}</span>
              <span className="caster-preview-main">
                <b>{name.trim() || "Nombre del caster…"}</b>
                <small>{tier === "official" ? "Oficial" : tier === "secondary" ? "Secundario" : "Comunidad"}{hasChannel ? ` · ${[tw && "Twitch", yt && "YouTube", kk && "Kick"].filter(Boolean).join(" · ")}` : " · sin canales todavía"}</small>
              </span>
            </div>
            {!hasChannel && <p className="vertigo-hint caster-hint">Tip: con un canal vinculado el caster rinde el doble en la grilla.</p>}
          </div>

          <div className="caster-actions">
            <button type="submit" className="vertigo-btn vertigo-btn-primary caster-cta" disabled={!name.trim()}>
              <Mic style={{ width: 14, height: 14 }} /> Crear caster
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
