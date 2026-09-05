"use client";

/**
 * Roster con toolbar: buscar + filtro por tier + pendientes primero.
 * Sin recargas — filtra en cliente sobre los datos del server.
 */

import { useMemo, useState } from "react";
import { Check, Clock, Search, X } from "lucide-react";
import CasterCard from "./caster-card";

export default function CastersManager({ casters, matchCount }: { casters: any[]; matchCount: Record<string, number> }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const hay = q.trim().toLowerCase();
    return (casters ?? []).filter((c) => {
      if (tier && c.tier !== tier) return false;
      if (!hay) return true;
      return `${c.display_name ?? ""} ${c.twitch_channel ?? ""} ${c.youtube_channel ?? ""} ${c.kick_channel ?? ""}`.toLowerCase().includes(hay);
    });
  }, [casters, q, tier]);

  const pendientes = filtered.filter((c) => !c.approved_at);
  const activos = filtered.filter((c) => !!c.approved_at);
  const tiers = ["official", "secondary", "community"] as const;
  const tierCount = (t: string) => (casters ?? []).filter((c) => c.tier === t).length;

  return (
    <div>
      <div className="caster-toolbar" role="search">
        <label className="caster-search">
          <Search size={13} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o canal…" aria-label="Buscar casters" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Limpiar"><X size={12} /></button>}
        </label>
        <div className="caster-filters" role="group" aria-label="Filtrar por tier">
          <button type="button" className={`caster-pill ${tier === null ? "is-active" : ""}`} onClick={() => setTier(null)}>
            Todos <b>{casters.length}</b>
          </button>
          {tiers.map((t) => (
            <button key={t} type="button" className={`caster-pill ${tier === t ? "is-active" : ""}`} onClick={() => setTier(tier === t ? null : t)}>
              {t === "official" ? "Oficial" : t === "secondary" ? "Secundario" : "Comunidad"} <b>{tierCount(t)}</b>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="vertigo-card"><div className="vertigo-empty">
          <div className="vertigo-empty-title">Sin resultados</div>
          <p className="vertigo-empty-desc">Probá con otro nombre, canal o limpiá el filtro de tier.</p>
        </div></div>
      ) : (
        <div className="caster-list">
          {pendientes.length > 0 && (
            <section>
              <div className="caster-pending-banner">
                <Clock size={13} />
                <b>Pendientes de aprobación</b>
                <span>{pendientes.length}</span>
                <small>Aparecen ocultos en /casters hasta aprobarlos</small>
              </div>
              <div className="caster-cards">
                {pendientes.map((c) => <CasterCard key={c.id} c={c} llaves={matchCount[c.id] ?? 0} />)}
              </div>
            </section>
          )}
          {activos.length > 0 && (
            <section>
              <div className="caster-group-head">
                <Check size={13} /> Al aire <span>{activos.length}</span>
              </div>
              <div className="caster-cards">
                {activos.map((c) => <CasterCard key={c.id} c={c} llaves={matchCount[c.id] ?? 0} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
