"use client";

/**
 * Formularios del panel /admin/torneo:
 *  - EditionConfigForm: edita la configuración de la edición seleccionada,
 *    organizada en TABS (identidad, competitivo, formato, comodines, fechas,
 *    términos) con barra de guardado sticky y detección de cambios sin
 *    guardar. Un solo <form>: las secciones ocultas se envían igual.
 *  - EditionLifecycle: stepper visual del ciclo de vida + transiciones.
 *  - EditionCreateForm: wizard en 3 pasos (plantilla → datos clave → revisión)
 *    para crear una edición, reciclando la config de torneos finalizados.
 *
 * Los actions devuelven {ok, error}: el componente muestra el error y hace
 * router.refresh() al guardar (patrón del bet-panel de apuestas).
 */

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { playSound } from "@/lib/sounds";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Crosshair,
  Dices,
  Flag,
  Lock,
  Megaphone,
  Minus,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Settings2,
  Swords,
  Tag,
  Target,
  Timer,
  Undo2,
  UserPlus,
} from "lucide-react";
import VertigoSelect, { type VertigoOption } from "@/components/admin/vertigo-select";
import VertigoDateTime from "@/components/admin/vertigo-date-time";
import {
  createEditionAction,
  updateEditionAction,
  setEditionStatusAction,
} from "@/server/actions/edicion";

const ELO_FIELD_OPTIONS: VertigoOption[] = [
  { value: "rm_1v1_max", label: "rm_1v1_max" },
  { value: "rm_1v1_current", label: "rm_1v1_current" },
];

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
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-[#b5adc4]">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--vertigo-faint)]">{hint}</p>}
    </div>
  );
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-md border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs text-[var(--vertigo-danger)]">
      {error}
    </p>
  );
}

/** Sub-grupo dentro de un tab: rótulo + hairline + grilla con aire. */
function Group({
  title,
  children,
  cols = "sm:grid-cols-2",
}: {
  title: string;
  children: React.ReactNode;
  cols?: string;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[2.5px] text-[#8f86a3]">{title}</span>
        <span className="h-px flex-1 bg-[var(--vertigo-line-soft)]" />
      </div>
      <div className={`grid grid-cols-1 ${cols} gap-5`}>{children}</div>
    </div>
  );
}

/** Tarjeta individual de comodín: icono, nombre, input y para qué sirve. */
function ComodinCard({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: typeof RefreshCw;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--vertigo-line-soft)] bg-[rgba(255,255,255,0.02)] p-4 transition-colors hover:border-[#3a3049]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[rgba(124,58,237,0.16)]">
          <Icon className="h-3.5 w-3.5 text-[#c4b5fd]" />
        </span>
        <span className="text-[12px] font-bold text-[var(--vertigo-text)]">{label}</span>
      </div>
      {children}
      <p className="mt-auto text-[10px] leading-relaxed text-[var(--vertigo-faint)]">{hint}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: typeof Tag; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.08)]">
        <Icon className="h-4 w-4 text-[#D4AF37]" />
      </span>
      <div>
        <h3 className="font-cinzel text-[15px] uppercase tracking-[0.14em] text-white">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--vertigo-muted)]">{desc}</p>
      </div>
    </div>
  );
}

const inputCls = "vertigo-input";

// ============================================================
// Editor de configuración — en tabs
// ============================================================

const TABS = [
  { id: "identidad", label: "Identidad", icon: Tag },
  { id: "competitivo", label: "Competitivo", icon: Target },
  { id: "formato", label: "Formato", icon: Swords },
  { id: "comodines", label: "Comodines", icon: Dices },
  { id: "fechas", label: "Fechas", icon: CalendarDays },
  { id: "terminos", label: "Términos", icon: ScrollText },
] as const;

export function EditionConfigForm({
  edition,
  hasBracket,
}: {
  edition: any;
  hasBracket: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("identidad");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("edition_id", edition.id);
    setPending(true);
    setError(null);
    const res = await updateEditionAction(fd);
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Error al guardar.");
      playSound("error");
      return;
    }
    setSaved(true);
    setDirty(false);
    playSound("success");
    router.refresh();
    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <form onSubmit={onSubmit} onInput={() => setDirty(true)} className="vertigo-card flex flex-col">
      {/* ── Tab bar ── */}
      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-[var(--vertigo-line-soft)] pb-4">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 font-cinzel text-[11px] uppercase tracking-[0.18em] transition-colors ${
                active
                  ? "border-[rgba(212,175,55,0.5)] bg-[rgba(124,58,237,0.18)] text-white"
                  : "border-transparent text-[#a99fc0] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
              }`}
            >
              <t.icon className={`h-3.5 w-3.5 ${active ? "text-[#D4AF37]" : ""}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── IDENTIDAD ── */}
      <div className={`flex flex-col gap-8 ${tab === "identidad" ? "" : "hidden"}`}>
        <SectionHeader icon={Tag} title="Identidad de la edición" desc="Nombre público, descripción y canales donde se transmite." />
        <Group title="Datos">
          <Field label="Nombre de la edición">
            <input name="name" className={inputCls} defaultValue={edition.name} required maxLength={120} />
          </Field>
          <Field label="Slug (identificador interno)" hint="No se puede cambiar después de crear la edición.">
            <input className={inputCls} value={edition.slug} disabled />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción">
              <textarea name="description" className="vertigo-textarea" rows={3} defaultValue={edition.description ?? ""} maxLength={2000} />
            </Field>
          </div>
        </Group>
        <Group title="Canales de transmisión" cols="sm:grid-cols-3">
          <Field label="Canal Twitch">
            <input name="twitch_channel" className={inputCls} defaultValue={edition.twitch_channel ?? ""} placeholder="vertigocup" />
          </Field>
          <Field label="Canal YouTube">
            <input name="youtube_channel" className={inputCls} defaultValue={edition.youtube_channel ?? ""} placeholder="@vertigocup" />
          </Field>
          <Field label="Canal Kick">
            <input name="kick_channel" className={inputCls} defaultValue={edition.kick_channel ?? ""} placeholder="vertigocup" />
          </Field>
        </Group>
      </div>

      {/* ── COMPETITIVO ── */}
      <div className={`flex flex-col gap-8 ${tab === "competitivo" ? "" : "hidden"}`}>
        <SectionHeader icon={Target} title="Reglas competitivas" desc="ELO permitido y settings de fairness para los sorteos." />
        <Group title="ELO del equipo (suma de los 3 jugadores)" cols="sm:grid-cols-3">
          <Field label="ELO máximo" hint="Un equipo que sume más no puede inscribirse.">
            <input name="elo_cap" type="number" className={inputCls} defaultValue={edition.elo_cap} />
          </Field>
          <Field label="Tolerancia ±" hint="Margen extra permitido sobre el cap.">
            <input name="elo_tolerance" type="number" className={inputCls} defaultValue={edition.elo_tolerance} />
          </Field>
          <Field label="Campo ELO" hint="Qué rating de AoE2 Companion se valida.">
            <VertigoSelect
              name="elo_field"
              defaultValue={edition.elo_field ?? "rm_1v1_max"}
              options={ELO_FIELD_OPTIONS}
            />
          </Field>
        </Group>
        <Group title="Sorteos">
          <Field label="Timeout de sorteo (min)" hint="Si un capitán no confirma a tiempo, se aplica el fallback.">
            <input name="draw_timeout_minutes" type="number" className={inputCls} defaultValue={edition.draw_timeout_minutes} />
          </Field>
          <Field label="Fairness">
            <label className="flex h-[46px] cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--vertigo-input-border)] bg-[var(--vertigo-input-bg)] px-3.5 text-sm text-[var(--vertigo-text)] transition-colors hover:border-[#3a3049]">
              <input type="checkbox" name="commit_reveal_enabled" defaultChecked={edition.commit_reveal_enabled} className="h-4 w-4" />
              Commit-reveal en los sorteos
            </label>
          </Field>
        </Group>
      </div>

      {/* ── FORMATO ── */}
      <div className={`flex flex-col gap-8 ${tab === "formato" ? "" : "hidden"}`}>
        <SectionHeader icon={Swords} title="Formato del torneo" desc="Tamaño de equipos, cupo y civilizaciones por ronda." />
        {hasBracket && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.07)] px-3.5 py-2.5 text-xs leading-relaxed text-[#fbd38d]">
            <Lock className="mt-0.5 h-3.5 w-3.5 flex-none" />
            Bracket generado: la estructura está congelada. Estos valores no se pueden cambiar en esta edición.
          </div>
        )}
        <Group title="Estructura">
          <Field label="Jugadores por equipo">
            <input name="team_size" type="number" min={1} className={inputCls} defaultValue={edition.team_size} disabled={hasBracket} />
          </Field>
          <Field label="Equipos máximos" hint="Tamaño del bracket: 32 = 5 rondas.">
            <input name="max_teams" type="number" min={2} className={inputCls} defaultValue={edition.max_teams} disabled={hasBracket} />
          </Field>
        </Group>
        <Group title="Civilizaciones">
          <Field label="Civs base" hint="Pool que se sortea en todas las rondas.">
            <input name="civs_base" type="number" min={1} className={inputCls} defaultValue={edition.civs_base} disabled={hasBracket} />
          </Field>
          <Field label="Civs extra (finalista)" hint="Se suman solo para la final.">
            <input name="civs_extra_finalist" type="number" min={0} className={inputCls} defaultValue={edition.civs_extra_finalist} disabled={hasBracket} />
          </Field>
        </Group>
      </div>

      {/* ── COMODINES ── */}
      <div className={`flex flex-col gap-8 ${tab === "comodines" ? "" : "hidden"}`}>
        <SectionHeader icon={Dices} title="Comodines por equipo" desc="Cuántos tiene cada equipo para toda la edición y cuánto dura la ventana para usarlos." />
        <Group title="Comodines de juego" cols="sm:grid-cols-2 lg:grid-cols-4">
          <ComodinCard icon={RefreshCw} label="Reroll" hint="Re-sortea una fase del ruleteo (modo, mapa o civs).">
            <input name="comodin_reroll" type="number" min={0} className={inputCls} defaultValue={edition.comodin_reroll} />
          </ComodinCard>
          <ComodinCard icon={Ban} label="Anular" hint="Anula la llave por inactividad o ausencia del rival.">
            <input name="comodin_anular" type="number" min={0} className={inputCls} defaultValue={edition.comodin_anular} />
          </ComodinCard>
          <ComodinCard icon={Crosshair} label="Elegir rival" hint="Define tu rival para la próxima ronda.">
            <input name="comodin_elegir_rival" type="number" min={0} className={inputCls} defaultValue={edition.comodin_elegir_rival} />
          </ComodinCard>
          <ComodinCard icon={UserPlus} label="Invocar pro" hint="Suma un jugador pro como refuerzo para una llave.">
            <input name="comodin_invocar_pro" type="number" min={0} className={inputCls} defaultValue={edition.comodin_invocar_pro} />
          </ComodinCard>
        </Group>
        <Group title="Tiempos" cols="sm:grid-cols-2">
          <ComodinCard icon={Timer} label="Ventana de comodines" hint="Minutos luego del sorteo en los que se pueden jugar comodines.">
            <input name="comodin_window_minutes" type="number" min={1} className={inputCls} defaultValue={edition.comodin_window_minutes} />
          </ComodinCard>
          <ComodinCard icon={Clock} label="Respuesta del pro" hint="Minutos que tiene el pro invocado para aceptar y cargarse.">
            <input name="invocar_pro_minutes" type="number" min={1} className={inputCls} defaultValue={edition.invocar_pro_minutes} />
          </ComodinCard>
        </Group>
      </div>

      {/* ── FECHAS ── */}
      <div className={`flex flex-col gap-8 ${tab === "fechas" ? "" : "hidden"}`}>
        <SectionHeader icon={CalendarDays} title="Fechas clave" desc="Opcionales: la apertura real de inscripciones la controla el estado de la edición." />
        <Group title="Inscripciones">
          <Field label="Apertura">
            <VertigoDateTime name="registration_opens_at" defaultValue={toDatetimeLocal(edition.registration_opens_at)} />
          </Field>
          <Field label="Cierre">
            <VertigoDateTime name="registration_closes_at" defaultValue={toDatetimeLocal(edition.registration_closes_at)} />
          </Field>
          <Field label="Ventana de pago (hs)" hint="Al aprobar un equipo tiene esta ventana para pagar su plaza. Vencida, el cron libera el lugar y avisa a la lista de espera.">
            <input name="payment_window_hours" type="number" min={1} className={inputCls} defaultValue={edition.payment_window_hours ?? 72} />
          </Field>
        </Group>
        <Group title="Torneo">
          <Field label="Inicio">
            <VertigoDateTime name="starts_at" defaultValue={toDatetimeLocal(edition.starts_at)} />
          </Field>
          <Field label="Fin">
            <VertigoDateTime name="ends_at" defaultValue={toDatetimeLocal(edition.ends_at)} />
          </Field>
        </Group>
      </div>

      {/* ── TÉRMINOS ── */}
      <div className={`flex flex-col gap-5 ${tab === "terminos" ? "" : "hidden"}`}>
        <SectionHeader icon={ScrollText} title="Términos de inscripción" desc="Lo que los capitanes aceptan al sellar su inscripción en el wizard." />
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--vertigo-line-soft)] bg-[var(--vertigo-input-bg)] px-4 py-3 text-sm text-[var(--vertigo-text)] transition-colors hover:border-[#3a3049]">
          <input type="checkbox" name="restream_required" defaultChecked={edition.restream_required} className="h-4 w-4" />
          Exigir aceptar restream obligatorio
        </label>
        <Field label="Texto de términos (el wizard lo muestra antes de aceptar)">
          <textarea name="terms_text" className="vertigo-textarea" rows={6} defaultValue={edition.terms_text ?? ""} maxLength={20000} />
        </Field>
      </div>

      {/* ── Barra de guardado sticky ── */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 flex flex-wrap items-center gap-3 rounded-b-2xl border-t border-[var(--vertigo-line-soft)] bg-[rgba(19,14,28,0.94)] px-6 py-4 backdrop-blur">
        {pending ? (
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#a99fc0]">Guardando…</span>
        ) : dirty ? (
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#fbbf24]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fbbf24]" />
            Cambios sin guardar
          </span>
        ) : saved ? (
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--vertigo-success)]">
            <Check className="h-3.5 w-3.5" /> Guardado
          </span>
        ) : (
          <span className="text-[11px] uppercase tracking-wider text-[var(--vertigo-faint)]">Configuración sincronizada</span>
        )}
        <FormError error={error} />
        <button
          type="submit"
          className="vertigo-btn vertigo-btn-primary ml-auto"
          disabled={pending || (!dirty && !saved && false)}
        >
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Ciclo de vida — stepper visual
// ============================================================

const STATUS_META: Record<string, { label: string; desc: string }> = {
  draft: { label: "Borrador", desc: "La edición se está configurando. No es visible para los equipos." },
  registration: { label: "Inscripción abierta", desc: "Los equipos se inscriben por el wizard. El handbook debe estar subido." },
  active: { label: "En curso", desc: "Torneo en juego. Las inscripciones están cerradas." },
  finished: { label: "Finalizada", desc: "Edición cerrada y archivada. Podés crear la próxima edición." },
};

const TRANSITIONS: Record<string, { next: string; label: string; icon: typeof Play; danger?: boolean; confirm?: string; variant?: "induction" }[]> = {
  draft: [
    { next: "registration", label: "Abrir inscripciones", icon: Megaphone, confirm: "¿Abrir las inscripciones de esta edición? Los equipos van a poder inscribirse por el wizard." },
  ],
  registration: [
    { next: "active", label: "Iniciar torneo", icon: Play, confirm: "¿Iniciar el torneo? Las inscripciones quedan cerradas y la edición pasa a estar en curso." },
    { next: "draft", label: "Volver a borrador", icon: Undo2, confirm: "¿Volver la edición a borrador? Los equipos ya inscriptos conservan su registro." },
  ],
  active: [
    { next: "finished", label: "Cerrar torneo", icon: Flag, danger: true },
  ],
  finished: [
    { next: "active", label: "Reabrir como en curso", icon: RotateCcw, confirm: "¿Reabrir esta edición finalizada? Vuelve a estar en curso." },
  ],
};

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
        ok
          ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)] text-[var(--vertigo-success)]"
          : "border-[var(--vertigo-line-soft)] text-[var(--vertigo-faint)]"
      }`}
    >
      {ok ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {label}
    </span>
  );
}

const STEPS = [
  { id: "draft", label: "Borrador" },
  { id: "registration", label: "Inscripciones" },
  { id: "active", label: "En curso" },
  { id: "finished", label: "Finalizada" },
];

export function EditionLifecycle({
  editionId,
  status,
  unfinishedMatches,
  edition,
  hasBracket,
}: {
  editionId: string;
  status: string;
  unfinishedMatches: number;
  edition: any;
  hasBracket: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = STATUS_META[status] ?? { label: status, desc: "" };
  const currentIdx = STEPS.findIndex((s) => s.id === status);

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
    <div className="vertigo-card flex flex-col gap-6">
      {/* ── Stepper ── */}
      <div className="flex items-start px-1 pt-1">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <Fragment key={s.id}>
              <div className="flex min-w-[78px] flex-col items-center gap-2 sm:min-w-[96px]">
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-bold transition-all ${
                    done
                      ? "border-[var(--vertigo-success)] bg-[rgba(34,197,94,0.12)] text-[var(--vertigo-success)]"
                      : current
                        ? "border-[#D4AF37] bg-[rgba(212,175,55,0.14)] text-[#e9d18a] shadow-[0_0_0_4px_rgba(212,175,55,0.12),0_0_18px_rgba(212,175,55,0.25)]"
                        : "border-[var(--vertigo-line-soft)] text-[var(--vertigo-faint)]"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : current ? <span className="h-2 w-2 rounded-full bg-[#D4AF37]" /> : i + 1}
                </span>
                <span
                  className={`text-center font-cinzel text-[9px] uppercase tracking-[0.16em] sm:text-[10px] ${
                    current ? "text-[#e9d18a]" : done ? "text-[var(--vertigo-muted)]" : "text-[var(--vertigo-faint)]"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mb-6 h-[2px] flex-1 self-start mt-4 rounded ${
                    i < currentIdx
                      ? "bg-gradient-to-r from-[rgba(34,197,94,0.7)] to-[rgba(34,197,94,0.35)]"
                      : "bg-[var(--vertigo-line-soft)]"
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* ── Estado actual ── */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--vertigo-line-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
        <span className="mt-1 h-2 w-2 flex-none animate-pulse rounded-full bg-[#D4AF37]" />
        <p className="text-xs leading-relaxed text-[var(--vertigo-muted)]">
          <strong className="text-[var(--vertigo-text)]">{meta.label}.</strong> {meta.desc}
          {status === "active" && (
            unfinishedMatches > 0
              ? ` Quedan ${unfinishedMatches} partido${unfinishedMatches === 1 ? "" : "s"} sin finalizar.`
              : " Todos los partidos están cerrados."
          )}
        </p>
      </div>

      {/* ── Checklist ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip ok={!!edition.handbook_uploaded_at} label="Handbook subido" />
        <Chip ok={!!(edition.starts_at || edition.registration_opens_at)} label="Fechas definidas" />
        <Chip ok={hasBracket} label="Bracket generado" />
        <Chip ok={(edition.terms_text ?? "").length > 0} label="Términos redactados" />
      </div>

      <FormError error={error} />

      {/* ── Transiciones ── */}
      {buttons.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--vertigo-line-soft)] pt-5">
          <span className="text-[10px] font-bold uppercase tracking-[2px] text-[var(--vertigo-faint)]">Siguiente paso</span>
          {buttons.map((t) => (
            <button
              key={t.next}
              type="button"
              disabled={pending != null}
              onClick={() => transition(t.next, t.confirm)}
              className={`vertigo-btn ${t.danger ? "vertigo-btn-danger" : "vertigo-btn-primary"} flex items-center gap-2`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {pending === t.next ? "Aplicando…" : t.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="border-t border-[var(--vertigo-line-soft)] pt-5 text-xs text-[var(--vertigo-faint)]">
          Sin transiciones disponibles desde este estado.
        </p>
      )}
    </div>
  );
}

// ============================================================
// Crear edición nueva (pre-cargada con la anterior)
// ============================================================

/** Valores por defecto del formato VÉRTIGO ("empezar de cero"). */
const BLANK_DEFAULTS = {
  name: "",
  description: "",
  elo_cap: 3500,
  elo_tolerance: 20,
  elo_field: "rm_1v1_max",
  team_size: 3,
  max_teams: 32,
  civs_base: 9,
  civs_extra_finalist: 3,
  comodin_reroll: 2,
  comodin_anular: 1,
  comodin_elegir_rival: 1,
  comodin_invocar_pro: 1,
  comodin_window_minutes: 5,
  invocar_pro_minutes: 5,
  payment_window_hours: 72,
  commit_reveal_enabled: true,
  draw_timeout_minutes: 5,
  twitch_channel: "",
  youtube_channel: "",
  kick_channel: "",
  restream_required: true,
};

const CREATE_STEPS = ["Plantilla", "Datos clave", "Revisión"] as const;

/** Fila del resumen del paso 3. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 rounded-lg border border-[var(--vertigo-line-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-2.5">
      <span className="flex-none text-[10px] font-bold uppercase tracking-[2px] text-[#8f86a3]">{label}</span>
      <span className="truncate text-right text-[13px] text-[var(--vertigo-text)]">{value}</span>
    </div>
  );
}

export function EditionCreateForm({ templates }: { templates: any[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState<string>("blank");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameMissing, setNameMissing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const tpl = templates.find((t: any) => t.id === templateId) ?? null;
  const d = (tpl ?? BLANK_DEFAULTS) as any;
  const rondas = Math.ceil(Math.log2(Math.max(2, d.max_teams ?? 32)));

  function goNext() {
    if (step === 2) {
      const name = nameRef.current?.value.trim() ?? "";
      if (!name) {
        setNameMissing(true);
        nameRef.current?.focus();
        return;
      }
    }
    setNameMissing(false);
    setError(null);
    playSound("swipe");
    setStep((s) => Math.min(CREATE_STEPS.length, s + 1));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const res = await createEditionAction(fd);
    setPending(false);
    if (!res.ok || !res.editionId) {
      setError(res.error ?? "No se pudo crear la edición.");
      playSound("error");
      return;
    }
    playSound("victory");
    router.push(`/admin/torneo?edition=${res.editionId}`);
  }

  return (
    <form onSubmit={onSubmit} className="vertigo-card flex flex-col gap-6">
      {/* Stepper */}
      <div className="flex items-center gap-3">
        {CREATE_STEPS.map((label, i) => {
          const n = i + 1;
          const current = n === step;
          const done = n < step;
          return (
            <Fragment key={label}>
              {i > 0 && <span className="h-px flex-1 bg-[var(--vertigo-line-soft)]" />}
              <button
                type="button"
                onClick={() => n < step && setStep(n)}
                className={`flex flex-none items-center gap-2 ${n < step ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[11px] font-bold ${
                    current
                      ? "border-[#D4AF37] bg-[rgba(212,175,55,0.12)] text-[#D4AF37] shadow-[0_0_14px_rgba(212,175,55,0.35)]"
                      : done
                        ? "border-[rgba(74,222,128,0.5)] bg-[rgba(74,222,128,0.08)] text-[#4ade80]"
                        : "border-[var(--vertigo-line-soft)] text-[var(--vertigo-faint)]"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </span>
                <span
                  className={`text-[11px] font-bold uppercase tracking-[1.5px] ${
                    current ? "text-[#D4AF37]" : done ? "text-[#4ade80]" : "text-[var(--vertigo-faint)]"
                  }`}
                >
                  {label}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>

      {/* Paso 1 — Plantilla */}
      <div className={step === 1 ? "flex flex-col gap-3" : "hidden"}>
        <p className="text-xs leading-relaxed text-[var(--vertigo-muted)]">
          La edición nueva arranca con la configuración que elijas. Todo se puede
          ajustar después, en el paso de revisión.
        </p>
        {[
          {
            id: "blank",
            icon: Swords,
            title: "Empezar de cero",
            desc: "Valores por defecto del formato VÉRTIGO: 32 equipos · ELO 3500 · 4 comodines · 9 civs.",
          },
          ...templates.map((t: any) => ({
            id: String(t.id),
            icon: RotateCcw,
            title: `Usar «${t.name}»`,
            desc: `Copia toda su configuración: ${t.max_teams ?? 32} equipos · ELO ${t.elo_cap ?? 3500} · ${t.civs_base ?? 9} civs · ${t.team_size ?? 3} jugadores.`,
          })),
        ].map((opt) => {
          const selected = templateId === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTemplateId(opt.id)}
              className={`flex items-start gap-3.5 rounded-xl border px-4 py-4 text-left transition-all ${
                selected
                  ? "border-[rgba(212,175,55,0.7)] bg-[rgba(212,175,55,0.06)] shadow-[0_0_22px_rgba(212,175,55,0.12)]"
                  : "border-[var(--vertigo-line-soft)] bg-[rgba(255,255,255,0.02)] hover:border-[#3a3049]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                  selected ? "border-[#D4AF37] bg-[#D4AF37]" : "border-[var(--vertigo-line-soft)]"
                }`}
              >
                {selected && <Check className="h-3 w-3 text-black" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 flex-none text-[#D4AF37]" />
                  <span className="text-sm font-semibold text-[var(--vertigo-text)]">{opt.title}</span>
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-[var(--vertigo-faint)]">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Paso 2 — Datos clave */}
      <div className={step === 2 ? "flex flex-col gap-6" : "hidden"}>
        <Field label="Nombre de la edición">
          <input
            ref={nameRef}
            name="name"
            className={inputCls}
            defaultValue={tpl ? `${tpl.name} — nueva` : ""}
            placeholder="VÉRTIGO Cup 2026 — 2ª edición"
            maxLength={120}
          />
        </Field>
        {nameMissing && (
          <p className="-mt-3 text-[11px] text-[var(--vertigo-danger)]">Elegí un nombre para continuar.</p>
        )}
        <Group title="Fechas — inscripciones">
          <Field label="Apertura">
            <VertigoDateTime name="registration_opens_at" defaultValue={toDatetimeLocal(tpl?.registration_opens_at)} />
          </Field>
          <Field label="Cierre">
            <VertigoDateTime name="registration_closes_at" defaultValue={toDatetimeLocal(tpl?.registration_closes_at)} />
          </Field>
        </Group>
        <Group title="Fechas — torneo">
          <Field label="Inicio">
            <VertigoDateTime name="starts_at" defaultValue={toDatetimeLocal(tpl?.starts_at)} />
          </Field>
          <Field label="Fin">
            <VertigoDateTime name="ends_at" defaultValue={toDatetimeLocal(tpl?.ends_at)} />
          </Field>
        </Group>
        <p className="text-[11px] text-[var(--vertigo-faint)]">
          Las fechas son opcionales: las podés definir más tarde, antes de abrir inscripciones.
        </p>
      </div>

      {/* Paso 3 — Revisión */}
      <div className={step === 3 ? "flex flex-col gap-5" : "hidden"}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <SummaryRow label="Plantilla" value={tpl ? tpl.name : "Empezar de cero"} />
          <SummaryRow label="Formato" value={`${d.max_teams ?? 32} equipos → ${rondas} rondas · ${d.team_size ?? 3} jugadores`} />
          <SummaryRow label="ELO" value={`Cap ${d.elo_cap ?? 3500} ±${d.elo_tolerance ?? 20} · ${d.elo_field ?? "rm_1v1_max"}`} />
          <SummaryRow label="Pago" value={`Ventana de ${d.payment_window_hours ?? 72}hs para pagar la plaza`} />
          <SummaryRow label="Civilizaciones" value={`${d.civs_base ?? 9} base + ${d.civs_extra_finalist ?? 3} finalista`} />
          <SummaryRow
            label="Comodines"
            value={`${d.comodin_reroll ?? 2} reroll · ${d.comodin_anular ?? 1} anular · ${d.comodin_elegir_rival ?? 1} rival · ${d.comodin_invocar_pro ?? 1} pro`}
          />
          <SummaryRow label="Sorteos" value={`Timeout ${d.draw_timeout_minutes ?? 5} min · fairness ${d.commit_reveal_enabled ? "activado" : "desactivado"}`} />
        </div>

        {/* Configuración avanzada heredada: colapsada — se abre solo para ajustar algo */}
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--vertigo-line-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-3.5 text-left transition-colors hover:border-[#3a3049]"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Settings2 className="h-4 w-4 flex-none text-[#D4AF37]" />
            <span className="flex-none text-sm font-medium text-[var(--vertigo-text)]">Configuración avanzada</span>
            <span className="truncate text-[11px] text-[var(--vertigo-faint)]">heredada de la plantilla — todo editable</span>
          </span>
          <ChevronDown className={`h-4 w-4 flex-none text-[#D4AF37] transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        <div
          key={templateId}
          className={`flex flex-col gap-8 rounded-xl border border-[var(--vertigo-line-soft)] bg-[rgba(255,255,255,0.015)] p-5 ${showAdvanced ? "" : "hidden"}`}
        >
          <Group title="Datos">
            <Field label="Slug (opcional — se genera del nombre)">
              <input name="slug" className={inputCls} placeholder="vertigo-2026-2" maxLength={80} />
            </Field>
            <Field label="Descripción">
              <textarea name="description" className="vertigo-textarea" rows={2} defaultValue={d.description ?? ""} maxLength={2000} />
            </Field>
          </Group>
          <Group title="Competitivo — ELO del equipo" cols="sm:grid-cols-3">
            <Field label="ELO máximo">
              <input name="elo_cap" type="number" className={inputCls} defaultValue={d.elo_cap ?? 3500} />
            </Field>
            <Field label="Tolerancia ±">
              <input name="elo_tolerance" type="number" className={inputCls} defaultValue={d.elo_tolerance ?? 20} />
            </Field>
            <Field label="Campo ELO">
              <VertigoSelect name="elo_field" defaultValue={d.elo_field ?? "rm_1v1_max"} options={ELO_FIELD_OPTIONS} />
            </Field>
          </Group>
          <Group title="Formato — estructura">
            <Field label="Jugadores por equipo">
              <input name="team_size" type="number" min={1} className={inputCls} defaultValue={d.team_size ?? 3} />
            </Field>
            <Field label="Equipos máximos" hint="Tamaño del bracket: 32 = 5 rondas.">
              <input name="max_teams" type="number" min={2} className={inputCls} defaultValue={d.max_teams ?? 32} />
            </Field>
          </Group>
          <Group title="Civilizaciones">
            <Field label="Civs base" hint="Pool que se sortea en todas las rondas.">
              <input name="civs_base" type="number" min={1} className={inputCls} defaultValue={d.civs_base ?? 9} />
            </Field>
            <Field label="Civs extra (finalista)" hint="Se suman solo para la final.">
              <input name="civs_extra_finalist" type="number" min={0} className={inputCls} defaultValue={d.civs_extra_finalist ?? 3} />
            </Field>
          </Group>
          <Group title="Sorteos">
            <Field label="Timeout de sorteo (min)">
              <input name="draw_timeout_minutes" type="number" className={inputCls} defaultValue={d.draw_timeout_minutes ?? 5} />
            </Field>
            <Field label="Fairness">
              <label className="flex h-[46px] cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--vertigo-input-border)] bg-[var(--vertigo-input-bg)] px-3.5 text-sm text-[var(--vertigo-text)] transition-colors hover:border-[#3a3049]">
                <input type="checkbox" name="commit_reveal_enabled" defaultChecked={d.commit_reveal_enabled ?? true} className="h-4 w-4" />
                Commit-reveal en los sorteos
              </label>
            </Field>
          </Group>
          <Group title="Comodines de juego" cols="sm:grid-cols-2 lg:grid-cols-4">
            <ComodinCard icon={RefreshCw} label="Reroll" hint="Re-sortea una fase del ruleteo (modo, mapa o civs).">
              <input name="comodin_reroll" type="number" min={0} className={inputCls} defaultValue={d.comodin_reroll ?? 2} />
            </ComodinCard>
            <ComodinCard icon={Ban} label="Anular" hint="Anula la llave por inactividad o ausencia del rival.">
              <input name="comodin_anular" type="number" min={0} className={inputCls} defaultValue={d.comodin_anular ?? 1} />
            </ComodinCard>
            <ComodinCard icon={Crosshair} label="Elegir rival" hint="Define tu rival para la próxima ronda.">
              <input name="comodin_elegir_rival" type="number" min={0} className={inputCls} defaultValue={d.comodin_elegir_rival ?? 1} />
            </ComodinCard>
            <ComodinCard icon={UserPlus} label="Invocar pro" hint="Suma un jugador pro como refuerzo para una llave.">
              <input name="comodin_invocar_pro" type="number" min={0} className={inputCls} defaultValue={d.comodin_invocar_pro ?? 1} />
            </ComodinCard>
          </Group>
          <Group title="Tiempos" cols="sm:grid-cols-2">
            <ComodinCard icon={Timer} label="Ventana de comodines" hint="Minutos luego del sorteo en los que se pueden jugar comodines.">
              <input name="comodin_window_minutes" type="number" min={1} className={inputCls} defaultValue={d.comodin_window_minutes ?? 5} />
            </ComodinCard>
            <ComodinCard icon={Clock} label="Respuesta del pro" hint="Minutos que tiene el pro invocado para aceptar y cargarse.">
              <input name="invocar_pro_minutes" type="number" min={1} className={inputCls} defaultValue={d.invocar_pro_minutes ?? 5} />
            </ComodinCard>
          </Group>
          <Group title="Pago de plazas" cols="sm:grid-cols-2">
            <Field label="Ventana de pago (hs)" hint="Al aprobar un equipo tiene esta ventana para pagar su plaza. Vencida, el cron libera el lugar y avisa a la lista de espera.">
              <input name="payment_window_hours" type="number" min={1} className={inputCls} defaultValue={d.payment_window_hours ?? 72} />
            </Field>
          </Group>
          <Group title="Canales de transmisión" cols="sm:grid-cols-3">
            <Field label="Canal Twitch">
              <input name="twitch_channel" className={inputCls} defaultValue={d.twitch_channel ?? ""} />
            </Field>
            <Field label="Canal YouTube">
              <input name="youtube_channel" className={inputCls} defaultValue={d.youtube_channel ?? ""} />
            </Field>
            <Field label="Canal Kick">
              <input name="kick_channel" className={inputCls} defaultValue={d.kick_channel ?? ""} />
            </Field>
          </Group>
          <Group title="Reglas">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--vertigo-line-soft)] bg-[var(--vertigo-input-bg)] px-4 py-3 text-sm text-[var(--vertigo-text)] transition-colors hover:border-[#3a3049]">
              <input type="checkbox" name="restream_required" defaultChecked={d.restream_required ?? true} className="h-4 w-4" />
              Exigir aceptar restream obligatorio
            </label>
          </Group>
        </div>

        <p className="text-[11px] leading-relaxed text-[var(--vertigo-faint)]">
          La edición nace en <strong className="text-[var(--vertigo-muted)]">borrador</strong>: sin inscripciones
          ni bracket. La abrís desde Ciclo de vida cuando esté lista.
        </p>
      </div>

      <FormError error={error} />
      <div className="vertigo-action-bar flex-wrap">
        {step > 1 && (
          <button
            type="button"
            onClick={() => {
              setNameMissing(false);
              setError(null);
              setStep((s) => s - 1);
            }}
            className="vertigo-btn"
          >
            Volver
          </button>
        )}
        {step < CREATE_STEPS.length ? (
          <button type="button" onClick={goNext} className="vertigo-btn vertigo-btn-primary">
            Continuar
          </button>
        ) : (
          <button type="submit" className="vertigo-btn vertigo-btn-primary" disabled={pending}>
            {pending ? "Creando…" : "Crear edición"}
          </button>
        )}
      </div>
    </form>
  );
}
