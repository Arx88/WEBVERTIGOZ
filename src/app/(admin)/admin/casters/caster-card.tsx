"use client";

/**
 * Card de moderación — jerarquía real, sin badge atolón.
 * Estado con dot · 1 pill de tier · acciones con peso distinto.
 * Delete con confirm en 2 pasos (patrón staff-table).
 */

import { useRef, useState } from "react";
import { Check, ExternalLink, Eye, EyeOff, Mic, Star, Trash2, Twitch, Youtube } from "lucide-react";
import VertigoSelect from "@/components/admin/vertigo-select";
import { fmt } from "@/lib/format";
import {
  deleteCasterAction,
  setCasterTierAction,
  setFeaturedCasterAction,
  toggleCasterApprovalAction,
} from "@/server/actions/auth";

const TIER_LABEL: Record<string, string> = { official: "Oficial", secondary: "Secundario", community: "Comunidad" };

export default function CasterCard({ c, llaves }: { c: any; llaves: number }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const tierForm = useRef<HTMLFormElement>(null);
  const pending = !c.approved_at;

  return (
    <article className={`caster-card ${pending ? "is-pending" : ""} ${c.featured ? "is-featured" : ""}`}>
      <header className="caster-card-top">
        <span className="caster-ava" aria-hidden>
          <Mic size={16} strokeWidth={1.5} />
        </span>
        <div className="caster-id">
          <h3>
            <span className={`caster-dot ${pending ? "is-pending" : "is-live"}`} title={pending ? "Pendiente" : "Al aire"} />
            {c.display_name}
          </h3>
          <p>{c.approved_at ? `Aprobado ${fmt.date(c.approved_at)}` : "Pendiente — oculto en /casters"}{llaves > 0 ? ` · ${llaves === 1 ? "1 llave" : `${llaves} llaves`} asignadas` : ""}</p>
        </div>
        <span className={`caster-tier tier-${c.tier}`}>{TIER_LABEL[c.tier] ?? c.tier}</span>
      </header>

      <div className="caster-chans">
        {c.twitch_channel && (
          <a href={`https://twitch.tv/${c.twitch_channel}`} target="_blank" rel="noopener noreferrer" className="caster-chan">
            <Twitch size={12} /> {c.twitch_channel} <ExternalLink size={10} />
          </a>
        )}
        {c.youtube_channel && (
          <a href={`https://youtube.com/@${String(c.youtube_channel).replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="caster-chan">
            <Youtube size={12} /> {c.youtube_channel} <ExternalLink size={10} />
          </a>
        )}
        {c.kick_channel && <span className="caster-chan quiet">Kick · {c.kick_channel}</span>}
        {!c.twitch_channel && !c.youtube_channel && !c.kick_channel && (
          <span className="caster-empty">Sin canales vinculados</span>
        )}
        {c.featured && <span className="caster-feat"><Star size={11} /> En reproductor principal</span>}
      </div>

      <footer className="caster-foot">
        <form ref={tierForm} action={setCasterTierAction} className="caster-tierform">
          <input type="hidden" name="caster_id" value={c.id} />
          <VertigoSelect
            name="tier" defaultValue={c.tier} compact title="Tier del caster" className="caster-tierselect"
            options={[
              { value: "official", label: "Oficial" },
              { value: "secondary", label: "Secundario" },
              { value: "community", label: "Comunidad" },
            ]}
            onValueChange={() => tierForm.current?.requestSubmit()}
          />
        </form>

        {c.approved_at && (
          <form action={setFeaturedCasterAction}>
            <input type="hidden" name="caster_id" value={c.id} />
            <button
              type="submit"
              className={`caster-btn ${c.featured ? "is-gold" : ""}`}
              title={c.featured ? "Quitar del reproductor principal" : "Su stream ocupa el reproductor principal cuando está en vivo"}
            >
              <Star size={12} style={c.featured ? { fill: "currentColor" } : undefined} />
              {c.featured ? "Destacado" : "Destacar"}
            </button>
          </form>
        )}

        <span className="caster-foot-sp" />

        <form action={toggleCasterApprovalAction}>
          <input type="hidden" name="caster_id" value={c.id} />
          {c.approved_at ? (
            <button type="submit" className="caster-btn" title="Ocultar de /casters"><EyeOff size={12} /> Ocultar</button>
          ) : (
            <button type="submit" className="caster-btn primary" title="Hacer visible en /casters"><Eye size={12} /> Aprobar</button>
          )}
        </form>

        {confirmDel ? (
          <span className="caster-confirm">
            <form action={deleteCasterAction}>
              <input type="hidden" name="caster_id" value={c.id} />
              <button type="submit" className="caster-btn danger"><Trash2 size={12} /> Sí, eliminar</button>
            </form>
            <button type="button" className="caster-btn" onClick={() => setConfirmDel(false)}>No</button>
          </span>
        ) : (
          <button type="button" className="caster-btn icon" title="Eliminar caster" onClick={() => setConfirmDel(true)}>
            <Trash2 size={12} />
          </button>
        )}
      </footer>

      {pending && (
        <span className="caster-pending-strip"><Check size={11} /> Acción requerida: aprobar u ocultar</span>
      )}
    </article>
  );
}
