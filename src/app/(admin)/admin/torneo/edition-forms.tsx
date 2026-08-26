"use client";

/**
 * Formularios del panel /admin/torneo:
 *  - EditionConfigForm: edita la configuración de la edición seleccionada.
 *  - EditionLifecycle: transiciones de estado (abrir inscripciones, iniciar,
 *    cerrar torneo, reabrir).
 *  - EditionCreateForm: crea una edición nueva pre-cargada con la anterior.
 *
 * Los actions devuelven {ok, error}: el componente muestra el error y hace
 * router.refresh() al guardar (patrón del bet-panel de apuestas).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createEditionAction,
  updateEditionAction,
  setEditionStatusAction,
} from "@/server/actions/edicion";

// ============================================================
// Utilidades
// ============================================================

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="vertigo-field">
      <label>{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[var(--vertigo-faint)] mt-1">{hint}</p>}
    </div>
  );
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="text-xs text-[var(--vertigo-danger)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-md px-3 py-2">
      {error}
    </p>
  );
}

const inputCls = "vertigo-input";

// ============================================================
// Editor de configuración
// ============================================================

export function EditionConfigForm({
  edition,
  hasBracket,
}: {
  edition: any;
  hasBracket: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("edition_id", edition.id);
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await updateEditionAction(fd);
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Error al guardar.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="vertigo-card flex flex-col gap-5">
        <div className="vertigo-card-title">Identidad</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre de la edición">
            <input name="name" className={inputCls} defaultValue={edition.name} required maxLength={120} />
          </Field>
          <Field label="Slug (identificador interno)" hint="No se puede cambiar después de crear la edición.">
            <input className={inputCls} value={edition.slug} disabled />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea name="description" className={inputCls} rows={2} defaultValue={edition.description ?? ""} maxLength={2000} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Canal Twitch">
            <input name="twitch_channel" className={inputCls} defaultValue={edition.twitch_channel ?? ""} placeholder="vertigocup" />
          </Field>
          <Field label="Canal YouTube">
            <input name="youtube_channel" className={inputCls} defaultValue={edition.youtube_channel ?? ""} placeholder="@vertigocup" />
          </Field>
          <Field label="Canal Kick">
            <input name="kick_channel" className={inputCls} defaultValue={edition.kick_channel ?? ""} placeholder="vertigocup" />
          </Field>
        </div>
      </div>

      <div className="vertigo-card flex flex-col gap-5">
        <div className="vertigo-card-title">Competitivo</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="ELO cap">
            <input name="elo_cap" type="number" className={inputCls} defaultValue={edition.elo_cap} />
          </Field>
          <Field label="Tolerancia ±">
            <input name="elo_tolerance" type="number" className={inputCls} defaultValue={edition.elo_tolerance} />
          </Field>
          <Field label="Campo ELO">
            <select name="elo_field" className={inputCls} defaultValue={edition.elo_field ?? "rm_1v1_max"}>
              <option value="rm_1v1_max">rm_1v1_max</option>
              <option value="rm_1v1_current">rm_1v1_current</option>
            </select>
          </Field>
          <Field label="Timeout de sorteo (min)">
            <input name="draw_timeout_minutes" type="number" className={inputCls} defaultValue={edition.draw_timeout_minutes} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--vertigo-text)]">
          <input type="checkbox" name="commit_reveal_enabled" defaultChecked={edition.commit_reveal_enabled} />
          Fairness con commit-reveal en los sorteos
        </label>
      </div>

      <div className="vertigo-card flex flex-col gap-5">
        <div className="vertigo-card-title">
          Formato
          {hasBracket && (
            <span className="vertigo-badge vertigo-badge-warning ml-2">Bracket generado — estructura congelada</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Jugadores por equipo">
            <input name="team_size" type="number" min={1} className={inputCls} defaultValue={edition.team_size} disabled={hasBracket} />
          </Field>
          <Field label="Equipos máximos">
            <input name="max_teams" type="number" min={2} className={inputCls} defaultValue={edition.max_teams} disabled={hasBracket} />
          </Field>
          <Field label="Civs base">
            <input name="civs_base" type="number" min={1} className={inputCls} defaultValue={edition.civs_base} disabled={hasBracket} />
          </Field>
          <Field label="Civs extra (finalista)">
            <input name="civs_extra_finalist" type="number" min={0} className={inputCls} defaultValue={edition.civs_extra_finalist} disabled={hasBracket} />
          </Field>
        </div>
      </div>

      <div className="vertigo-card flex flex-col gap-5">
        <div className="vertigo-card-title">Comodines por equipo</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Field label="Reroll">
            <input name="comodin_reroll" type="number" min={0} className={inputCls} defaultValue={edition.comodin_reroll} />
          </Field>
          <Field label="Anular">
            <input name="comodin_anular" type="number" min={0} className={inputCls} defaultValue={edition.comodin_anular} />
          </Field>
          <Field label="Elegir rival">
            <input name="comodin_elegir_rival" type="number" min={0} className={inputCls} defaultValue={edition.comodin_elegir_rival} />
          </Field>
          <Field label="Invocar pro">
            <input name="comodin_invocar_pro" type="number" min={0} className={inputCls} defaultValue={edition.comodin_invocar_pro} />
          </Field>
          <Field label="Ventana (min)">
            <input name="comodin_window_minutes" type="number" min={1} className={inputCls} defaultValue={edition.comodin_window_minutes} />
          </Field>
          <Field label="Invocar pro (min)">
            <input name="invocar_pro_minutes" type="number" min={1} className={inputCls} defaultValue={edition.invocar_pro_minutes} />
          </Field>
        </div>
      </div>

      <div className="vertigo-card flex flex-col gap-5">
        <div className="vertigo-card-title">Fechas</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Apertura de inscripciones">
            <input name="registration_opens_at" type="datetime-local" className={inputCls} defaultValue={toDatetimeLocal(edition.registration_opens_at)} />
          </Field>
          <Field label="Cierre de inscripciones">
            <input name="registration_closes_at" type="datetime-local" className={inputCls} defaultValue={toDatetimeLocal(edition.registration_closes_at)} />
          </Field>
          <Field label="Inicio del torneo">
            <input name="starts_at" type="datetime-local" className={inputCls} defaultValue={toDatetimeLocal(edition.starts_at)} />
          </Field>
          <Field label="Fin del torneo">
            <input name="ends_at" type="datetime-local" className={inputCls} defaultValue={toDatetimeLocal(edition.ends_at)} />
          </Field>
        </div>
      </div>

      <div className="vertigo-card flex flex-col gap-5">
        <div className="vertigo-card-title">Términos de inscripción</div>
        <label className="flex items-center gap-2 text-sm text-[var(--vertigo-text)]">
          <input type="checkbox" name="restream_required" defaultChecked={edition.restream_required} />
          Exigir aceptar restream obligatorio
        </label>
        <Field label="Texto de términos (el wizard lo muestra antes de aceptar)">
          <textarea name="terms_text" className={inputCls} rows={4} defaultValue={edition.terms_text ?? ""} maxLength={20000} />
        </Field>
      </div>

      <FormError error={error} />
      <div className="flex items-center gap-4">
        <button type="submit" className="vertigo-btn vertigo-btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>
        {saved && <span className="text-xs text-[var(--vertigo-success)]">✓ Guardado</span>}
      </div>
    </form>
  );
}

// ============================================================
// Ciclo de vida
// ============================================================

const STATUS_META: Record<string, { cls: string; label: string; desc: string }> = {
  draft: { cls: "vertigo-badge-purple", label: "Borrador", desc: "La edición se está configurando. No es visible para los equipos." },
  registration: { cls: "vertigo-badge-warning", label: "Inscripción abierta", desc: "Los equipos se inscriben por el wizard. El handbook debe estar subido." },
  active: { cls: "vertigo-badge-danger", label: "En curso", desc: "Torneo en juego. Las inscripciones están cerradas." },
  finished: { cls: "vertigo-badge-success", label: "Finalizada", desc: "Edición cerrada y archivada. Podés crear la próxima edición." },
};

const TRANSITIONS: Record<string, { next: string; label: string; confirm?: string }[]> = {
  draft: [
    { next: "registration", label: "Abrir inscripciones", confirm: "¿Abrir las inscripciones de esta edición? Los equipos van a poder inscribirse por el wizard." },
  ],
  registration: [
    { next: "active", label: "Iniciar torneo", confirm: "¿Iniciar el torneo? Las inscripciones quedan cerradas y la edición pasa a estar en curso." },
    { next: "draft", label: "Volver a borrador", confirm: "¿Volver la edición a borrador? Los equipos ya inscriptos conservan su registro." },
  ],
  active: [
    { next: "finished", label: "Cerrar torneo" },
  ],
  finished: [
    { next: "active", label: "Reabrir como en curso", confirm: "¿Reabrir esta edición finalizada? Vuelve a estar en curso." },
  ],
};

export function EditionLifecycle({
  editionId,
  status,
  unfinishedMatches,
}: {
  editionId: string;
  status: string;
  unfinishedMatches: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = STATUS_META[status] ?? { cls: "vertigo-badge-purple", label: status, desc: "" };

  async function transition(next: string, confirmMsg?: string) {
    if (next === "finished" && unfinishedMatches > 0) {
      const ok = window.confirm(
        `Hay ${unfinishedMatches} partido${unfinishedMatches === 1 ? "" : "s"} sin finalizar. ¿Cerrar la edición de todos modos?`
      );
      if (!ok) return;
    } else if (confirmMsg && !window.confirm(confirmMsg)) {
      return;
    }
    const fd = new FormData();
    fd.set("edition_id", editionId);
    fd.set("next_status", next);
    fd.set("confirm", "1");
    setPending(next);
    setError(null);
    const res = await setEditionStatusAction(fd);
    setPending(null);
    if (!res.ok) {
      setError(res.error ?? "Error al cambiar el estado.");
      return;
    }
    router.refresh();
  }

  const buttons = TRANSITIONS[status] ?? [];

  return (
    <div className="vertigo-card flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`vertigo-badge ${meta.cls}`}>{meta.label}</span>
        <span className="text-xs text-[var(--vertigo-muted)]">{meta.desc}</span>
      </div>
      {status === "active" && (
        <p className="text-xs text-[var(--vertigo-muted)]">
          {unfinishedMatches > 0
            ? `${unfinishedMatches} partido${unfinishedMatches === 1 ? "" : "s"} sin finalizar en esta edición.`
            : "Todos los partidos de la edición están cerrados."}
        </p>
      )}
      <FormError error={error} />
      {buttons.length > 0 ? (
        <div className="flex items-center gap-3 flex-wrap">
          {buttons.map((t) => (
            <button
              key={t.next}
              type="button"
              className={t.next === "finished" ? "vertigo-btn vertigo-btn-danger" : "vertigo-btn vertigo-btn-primary"}
              disabled={pending != null}
              onClick={() => transition(t.next, t.confirm)}
            >
              {pending === t.next ? "Aplicando…" : t.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--vertigo-faint)]">Sin transiciones disponibles desde este estado.</p>
      )}
    </div>
  );
}

// ============================================================
// Crear edición nueva (pre-cargada con la anterior)
// ============================================================

export function EditionCreateForm({ defaults }: { defaults: any }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const res = await createEditionAction(fd);
    setPending(false);
    if (!res.ok || !res.editionId) {
      setError(res.error ?? "No se pudo crear la edición.");
      return;
    }
    router.push(`/admin/torneo?edition=${res.editionId}`);
  }

  return (
    <form onSubmit={onSubmit} className="vertigo-card flex flex-col gap-5">
      <p className="text-xs text-[var(--vertigo-muted)] -mt-1">
        Se pre-carga con la configuración de la última edición. Ajustá lo que cambie
        y creala: nace en <strong>borrador</strong>, sin inscripciones ni bracket.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre de la edición">
          <input name="name" className={inputCls} defaultValue={defaults?.name ? `${defaults.name} — nueva` : ""} placeholder="VÉRTIGO Cup 2026 — 2ª edición" required maxLength={120} />
        </Field>
        <Field label="Slug (opcional — se genera del nombre)">
          <input name="slug" className={inputCls} placeholder="vertigo-2026-2" maxLength={80} />
        </Field>
      </div>
      <Field label="Descripción">
        <textarea name="description" className={inputCls} rows={2} defaultValue={defaults?.description ?? ""} maxLength={2000} />
      </Field>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="ELO cap">
          <input name="elo_cap" type="number" className={inputCls} defaultValue={defaults?.elo_cap ?? 3500} />
        </Field>
        <Field label="Tolerancia ±">
          <input name="elo_tolerance" type="number" className={inputCls} defaultValue={defaults?.elo_tolerance ?? 20} />
        </Field>
        <Field label="Campo ELO">
          <select name="elo_field" className={inputCls} defaultValue={defaults?.elo_field ?? "rm_1v1_max"}>
            <option value="rm_1v1_max">rm_1v1_max</option>
            <option value="rm_1v1_current">rm_1v1_current</option>
          </select>
        </Field>
        <Field label="Timeout de sorteo (min)">
          <input name="draw_timeout_minutes" type="number" className={inputCls} defaultValue={defaults?.draw_timeout_minutes ?? 5} />
        </Field>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Jugadores por equipo">
          <input name="team_size" type="number" min={1} className={inputCls} defaultValue={defaults?.team_size ?? 3} />
        </Field>
        <Field label="Equipos máximos">
          <input name="max_teams" type="number" min={2} className={inputCls} defaultValue={defaults?.max_teams ?? 32} />
        </Field>
        <Field label="Civs base">
          <input name="civs_base" type="number" min={1} className={inputCls} defaultValue={defaults?.civs_base ?? 9} />
        </Field>
        <Field label="Civs extra (finalista)">
          <input name="civs_extra_finalist" type="number" min={0} className={inputCls} defaultValue={defaults?.civs_extra_finalist ?? 3} />
        </Field>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Field label="Reroll">
          <input name="comodin_reroll" type="number" min={0} className={inputCls} defaultValue={defaults?.comodin_reroll ?? 2} />
        </Field>
        <Field label="Anular">
          <input name="comodin_anular" type="number" min={0} className={inputCls} defaultValue={defaults?.comodin_anular ?? 1} />
        </Field>
        <Field label="Elegir rival">
          <input name="comodin_elegir_rival" type="number" min={0} className={inputCls} defaultValue={defaults?.comodin_elegir_rival ?? 1} />
        </Field>
        <Field label="Invocar pro">
          <input name="comodin_invocar_pro" type="number" min={0} className={inputCls} defaultValue={defaults?.comodin_invocar_pro ?? 1} />
        </Field>
        <Field label="Ventana (min)">
          <input name="comodin_window_minutes" type="number" min={1} className={inputCls} defaultValue={defaults?.comodin_window_minutes ?? 5} />
        </Field>
        <Field label="Invocar pro (min)">
          <input name="invocar_pro_minutes" type="number" min={1} className={inputCls} defaultValue={defaults?.invocar_pro_minutes ?? 5} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Apertura de inscripciones">
          <input name="registration_opens_at" type="datetime-local" className={inputCls} />
        </Field>
        <Field label="Cierre de inscripciones">
          <input name="registration_closes_at" type="datetime-local" className={inputCls} />
        </Field>
        <Field label="Inicio del torneo">
          <input name="starts_at" type="datetime-local" className={inputCls} />
        </Field>
        <Field label="Fin del torneo">
          <input name="ends_at" type="datetime-local" className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Canal Twitch">
          <input name="twitch_channel" className={inputCls} defaultValue={defaults?.twitch_channel ?? ""} />
        </Field>
        <Field label="Canal YouTube">
          <input name="youtube_channel" className={inputCls} defaultValue={defaults?.youtube_channel ?? ""} />
        </Field>
        <Field label="Canal Kick">
          <input name="kick_channel" className={inputCls} defaultValue={defaults?.kick_channel ?? ""} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--vertigo-text)]">
        <input type="checkbox" name="restream_required" defaultChecked={defaults?.restream_required ?? true} />
        Exigir aceptar restream obligatorio
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--vertigo-text)]">
        <input type="checkbox" name="commit_reveal_enabled" defaultChecked={defaults?.commit_reveal_enabled ?? true} />
        Fairness con commit-reveal en los sorteos
      </label>

      <FormError error={error} />
      <div className="vertigo-action-bar">
        <button type="submit" className="vertigo-btn vertigo-btn-primary" disabled={pending}>
          {pending ? "Creando…" : "Crear edición"}
        </button>
      </div>
    </form>
  );
}
