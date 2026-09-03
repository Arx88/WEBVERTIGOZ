"use client";

/**
 * Editor COMPLETO del preset de ruleta de /admin/ruletas.
 *
 * Todo el estado vive en memoria (useState del config entero): el admin
 * agrega, quita, duplica, reordena y edita opciones (título, arte, color,
 * textos, reglas, peso, civsPorEquipo, formato de llave, pool de mapas por
 * antimeta) + la presentación, y un SOLO botón "Guardar configuración"
 * persiste todo junto via saveRuletaPresetAction.
 *
 * La ruleta en vivo matchea el resultado del sorteo por ID — cambiar un id
 * rompe la animación de draws ya girados, así que el id NO se edita.
 */

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban, Check, ChevronDown, ChevronUp, Copy, ImageOff, Loader2, Map as MapIcon,
  Plus, Save, Sparkles, Swords, Trash2, Volume2, X,
} from "lucide-react";
import { saveRuletaPresetAction } from "@/server/actions/ruleta";

// ─────────────────────────────────────────────────────────────
// Tipos (espejo del config de preset_version / draw-engine)
// ─────────────────────────────────────────────────────────────

export interface EditorOption {
  id: string;
  title: string;
  tag?: string;
  color?: string;
  img?: string;
  kind?: string;
  tagline?: string;
  description?: string;
  rules?: string[];
  weight?: number;
  civsPerTeam?: number;
  llaveFormat?: "BO1" | "BO3";
  mapPool?: "global" | EditorOption[];
}

export interface EditorList {
  kind: "MODO" | "ANTIMETA" | "FORMATO" | "LLAVE" | "MAPA";
  label: string;
  desc: string;
  options: EditorOption[];
}

interface Presentation {
  music: { enabled: boolean; volume: number };
  sounds: { enabled: boolean; volume: number };
  background: "fondo" | "vortex";
  firstRound: boolean;
  epicCards: boolean;
}

const LIST_ICONS = { MODO: Sparkles, ANTIMETA: Ban, FORMATO: Swords, LLAVE: Swords, MAPA: MapIcon } as const;
const KIND_TO_CONFIG_KEY = {
  MODO: "gameModes",
  ANTIMETA: "antimetaModes",
  FORMATO: "playerModes",
  LLAVE: "llaveModes",
  MAPA: "mapModes",
} as const;

const DEFAULT_COLORS = ["#ff2e7e", "#22e5c2", "#d8a13f", "#b06bff", "#ff6b00", "#ff5aa5"];

function generateId(kind: string): string {
  const prefix = { MODO: "gm", ANTIMETA: "am", FORMATO: "pm", LLAVE: "ll", MAPA: "map" }[kind] ?? "opt";
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isAntimetaMode(o: EditorOption): boolean {
  return /antimeta/i.test(o.title ?? "") || /antimeta/i.test(o.id ?? "");
}

// ─────────────────────────────────────────────────────────────
// Editor principal
// ─────────────────────────────────────────────────────────────

export default function RuletaEditor({
  editionId,
  presetVersion,
  disabled,
  lists: initialLists,
  presentation: initialPresentation,
  availableArt,
}: {
  editionId: string;
  presetVersion: number;
  disabled: boolean;
  lists: EditorList[];
  presentation: Presentation;
  availableArt: string[];
}) {
  const [lists, setLists] = useState<EditorList[]>(initialLists);
  const [presentation, setPresentation] = useState<Presentation>(initialPresentation);
  const [tab, setTab] = useState<(EditorList["kind"] | "PRESENTACION")>("MODO");
  const [openId, setOpenId] = useState<string | null>(null); // opción en edición
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Validaciones client-side (espejo de validatePresetConfig de la action)
  const problems = useMemo(() => {
    const errs: string[] = [];
    const req: [EditorList["kind"], string][] = [
      ["MODO", "Modos"],
      ["FORMATO", "Formatos"],
      ["MAPA", "Mapas"],
    ];
    for (const [kind, label] of req) {
      const l = lists.find((x) => x.kind === kind);
      if (!l || l.options.length === 0) errs.push(`${label}: la lista no puede quedar vacía.`);
      else if (!l.options.some((o) => (o.weight ?? 1) > 0)) errs.push(`${label}: dejá al menos una opción activa (peso > 0).`);
    }
    const ids = new Set<string>();
    for (const l of lists) for (const o of l.options) {
      if (ids.has(o.id)) errs.push(`Id duplicado: ${o.id}.`);
      ids.add(o.id);
    }
    return errs;
  }, [lists]);

  const touch = (fn: () => void) => {
    fn();
    setDirty(true);
    setSaved(false);
  };

  // Mutadores de listas ──────────────────────────────────────

  const setOptions = (kind: EditorList["kind"], next: EditorOption[]) => {
    touch(() => setLists((ls) => ls.map((l) => (l.kind === kind ? { ...l, options: next } : l))));
  };
  const patchOption = (kind: EditorList["kind"], id: string, patch: Partial<EditorOption>) => {
    touch(() => setLists((ls) => ls.map((l) =>
      l.kind === kind ? { ...l, options: l.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) } : l
    )));
  };
  const moveOption = (kind: EditorList["kind"], idx: number, dir: -1 | 1) => {
    const list = lists.find((l) => l.kind === kind);
    if (!list) return;
    const next = [...list.options];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setOptions(kind, next);
  };
  const duplicateOption = (kind: EditorList["kind"], id: string) => {
    const list = lists.find((l) => l.kind === kind);
    const src = list?.options.find((o) => o.id === id);
    if (!src || !list) return;
    const copy: EditorOption = { ...src, id: generateId(kind), title: `${src.title} (copia)` };
    const idx = list.options.findIndex((o) => o.id === id);
    const next = [...list.options];
    next.splice(idx + 1, 0, copy);
    setOptions(kind, next);
    setOpenId(copy.id);
  };
  const deleteOption = (kind: EditorList["kind"], id: string) => {
    const list = lists.find((l) => l.kind === kind);
    if (!list) return;
    const next = list.options.filter((o) => o.id !== id);
    if (kind !== "MODO" && kind !== "FORMATO" && kind !== "MAPA" && next.length === 0) {
      // listas opcionales pueden quedar vacías, pero ANTIMETA vacía desactiva la 2ª fase
    }
    setOptions(kind, next);
    if (openId === id) setOpenId(null);
    setConfirmDeleteId(null);
  };
  const addOption = (kind: EditorList["kind"]) => {
    const list = lists.find((l) => l.kind === kind);
    if (!list) return;
    const color = DEFAULT_COLORS[list.options.length % DEFAULT_COLORS.length];
    const fresh: EditorOption = {
      id: generateId(kind),
      title: "",
      tag: list.options[0]?.tag ?? "NUEVO",
      color,
      img: list.options[0]?.img ?? availableArt[0] ?? "",
      kind,
      tagline: "",
      description: "",
      rules: [],
      weight: 1,
      ...(kind === "FORMATO" ? { civsPerTeam: 1 } : {}),
      ...(kind === "LLAVE" ? { llaveFormat: "BO1" as const } : {}),
      ...(kind === "ANTIMETA" ? { mapPool: "global" as const } : {}),
    };
    setOptions(kind, [...list.options, fresh]);
    setOpenId(fresh.id);
  };

  // Guardar ─────────────────────────────────────────────────

  const buildConfigJson = () => {
    const config: Record<string, unknown> = {
      music: presentation.music,
      sounds: presentation.sounds,
      background: presentation.background,
      firstRound: presentation.firstRound,
      epicCards: presentation.epicCards,
    };
    for (const l of lists) config[KIND_TO_CONFIG_KEY[l.kind]] = l.options;
    return JSON.stringify(config);
  };

  const save = () => {
    if (problems.length > 0) return;
    setError(null);
    const fd = new FormData(formRef.current!);
    fd.set("edition_id", editionId);
    fd.set("preset_config", buildConfigJson());
    startTransition(async () => {
      const r = await saveRuletaPresetAction(fd);
      if (!r.ok) {
        setError(r.error ?? "No se pudo guardar.");
        return;
      }
      setSaved(true);
      setDirty(false);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  };

  const activeList = lists.find((l) => l.kind === tab);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {/* ── Sticky bar: estado + Guardar ── */}
      <div
        className="sticky top-0 z-20 mb-5 flex flex-wrap items-center gap-3 rounded-xl px-5 py-4"
        style={{
          background: dirty ? "rgba(124,58,237,0.10)" : "rgba(13,9,19,0.85)",
          border: `1px solid ${dirty ? "rgba(124,58,237,0.45)" : "var(--vertigo-line-soft)"}`,
          backdropFilter: "blur(8px)",
        }}
      >
        <span className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: dirty ? "var(--vertigo-purple-soft)" : "var(--vertigo-faint)" }}>
          {dirty ? "Cambios sin guardar" : saved ? "Guardado ✓" : `Preset v${presetVersion} — todo sincronizado`}
        </span>
        <span className="flex-1" />
        {error && <span className="max-w-[420px] text-xs" style={{ color: "var(--vertigo-danger)" }}>{error}</span>}
        {problems.length > 0 && dirty && (
          <span className="max-w-[420px] text-xs" style={{ color: "var(--vertigo-warning, #fbbf24)" }}>
            {problems[0]}
            {problems.length > 1 ? ` (+${problems.length - 1} más)` : ""}
          </span>
        )}
        <button
          type="submit"
          disabled={disabled || pending || !dirty || problems.length > 0}
          className="vertigo-btn vertigo-btn-primary"
          style={{ fontSize: 11, padding: "9px 20px", opacity: disabled || !dirty || problems.length > 0 ? 0.55 : 1 }}
        >
          {pending ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 13, height: 13 }} />}
          Guardar configuración
        </button>
      </div>

      {/* ── Tab bar: 5 fases + presentación ── */}
      <div
        className="mb-6 flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {lists.map((l) => {
          const Icon = LIST_ICONS[l.kind];
          const n = l.options.length;
          const nActive = l.options.filter((o) => (o.weight ?? 1) > 0).length;
          const isActive = tab === l.kind;
          return (
            <button
              key={l.kind}
              type="button"
              onClick={() => { setTab(l.kind); setOpenId(null); setConfirmDeleteId(null); }}
              className="flex flex-none items-center gap-2 rounded-lg border px-3.5 py-2 font-cinzel text-[11px] uppercase tracking-[1.5px] transition-colors"
              style={{
                borderColor: isActive ? "rgba(212,175,55,0.5)" : "var(--vertigo-line-soft)",
                background: isActive ? "rgba(124,58,237,0.18)" : "rgba(13,9,19,0.6)",
                color: isActive ? "#fff" : "var(--vertigo-muted)",
              }}
            >
              <Icon style={{ width: 13, height: 13 }} />
              {l.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                style={{
                  background: nActive === 0 ? "rgba(239,68,68,0.2)" : "rgba(124,58,237,0.2)",
                  color: nActive === 0 ? "var(--vertigo-danger)" : "var(--vertigo-purple-soft)",
                }}
                title={`${nActive} activas de ${n}`}
              >
                {nActive}/{n}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => { setTab("PRESENTACION"); setOpenId(null); setConfirmDeleteId(null); }}
          className="flex flex-none items-center gap-2 rounded-lg border px-3.5 py-2 font-cinzel text-[11px] uppercase tracking-[1.5px] transition-colors"
          style={{
            borderColor: tab === "PRESENTACION" ? "rgba(212,175,55,0.5)" : "var(--vertigo-line-soft)",
            background: tab === "PRESENTACION" ? "rgba(124,58,237,0.18)" : "rgba(13,9,19,0.6)",
            color: tab === "PRESENTACION" ? "#fff" : "var(--vertigo-muted)",
          }}
        >
          <Volume2 style={{ width: 13, height: 13 }} />
          Presentación
        </button>
      </div>

      {/* ── Contenido ── */}
      {tab === "PRESENTACION" ? (
        <PresentationPanel value={presentation} disabled={disabled} onChange={(p) => touch(() => setPresentation(p))} />
      ) : activeList && (
        <section>
          <p className="mb-4 text-xs" style={{ color: "var(--vertigo-faint)" }}>{activeList.desc}</p>

          {!disabled && (
            <button
              type="button"
              onClick={() => addOption(activeList.kind)}
              className="vertigo-btn vertigo-btn-ghost mb-4"
              style={{ fontSize: 11, padding: "8px 16px" }}
            >
              <Plus style={{ width: 13, height: 13 }} />
              Agregar {activeList.label.slice(0, -1).toLowerCase() || "opción"}
            </button>
          )}

          <div className="flex flex-col gap-3">
            {activeList.options.map((opt, idx) => (
              <OptionRow
                key={opt.id}
                opt={opt}
                kind={activeList.kind}
                idx={idx}
                total={activeList.options.length}
                disabled={disabled}
                maps={lists.find((l) => l.kind === "MAPA")?.options ?? []}
                art={availableArt}
                open={openId === opt.id}
                confirmDelete={confirmDeleteId === opt.id}
                onToggleOpen={() => { setOpenId(openId === opt.id ? null : opt.id); setConfirmDeleteId(null); }}
                onWeight={(w) => patchOption(activeList.kind, opt.id, { weight: w })}
                onMove={(d) => moveOption(activeList.kind, idx, d)}
                onDuplicate={() => duplicateOption(activeList.kind, opt.id)}
                onDelete={() => {
                  if (confirmDeleteId === opt.id) deleteOption(activeList.kind, opt.id);
                  else setConfirmDeleteId(opt.id);
                }}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onPatch={(patch) => patchOption(activeList.kind, opt.id, patch)}
              />
            ))}
            {activeList.options.length === 0 && (
              <div className="ad-empty">No hay opciones en esta lista. Agregá la primera con el botón de arriba.</div>
            )}
          </div>
        </section>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Fila de opción (card) + drawer de edición
// ─────────────────────────────────────────────────────────────

function OptionRow({
  opt, kind, idx, total, disabled, maps, art, open, confirmDelete,
  onToggleOpen, onWeight, onMove, onDuplicate, onDelete, onCancelDelete, onPatch,
}: {
  opt: EditorOption;
  kind: EditorList["kind"];
  idx: number;
  total: number;
  disabled: boolean;
  maps: EditorOption[];
  art: string[];
  open: boolean;
  confirmDelete: boolean;
  onToggleOpen: () => void;
  onWeight: (w: number) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onPatch: (patch: Partial<EditorOption>) => void;
}) {
  const active = (opt.weight ?? 1) > 0;
  const mapPoolCount = Array.isArray(opt.mapPool) ? opt.mapPool.length : null;

  return (
    <div
      className="rounded-xl"
      style={{
        background: open ? "rgba(124,58,237,0.05)" : "rgba(13,9,19,0.6)",
        border: `1px solid ${open ? "rgba(124,58,237,0.35)" : active ? "var(--vertigo-line-soft)" : "var(--vertigo-line-soft)"}`,
        opacity: active ? 1 : 0.55,
      }}
    >
      {/* Header de la fila */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* mini imagen */}
        {opt.img ? (
          <img src={opt.img} alt="" style={{ width: 44, height: 26, objectFit: "cover", borderRadius: 5, flex: "none", border: `1px solid ${opt.color ?? "#333"}55` }} />
        ) : (
          <div className="flex items-center justify-center" style={{ width: 44, height: 26, borderRadius: 5, background: "rgba(255,255,255,0.04)", flex: "none" }}>
            <ImageOff style={{ width: 12, height: 12, color: "var(--vertigo-faint)" }} />
          </div>
        )}

        <button type="button" onClick={onToggleOpen} className="min-w-0 flex-1 text-left" style={{ cursor: "pointer" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold" style={{ color: "var(--vertigo-text)" }}>
              {opt.title || <em style={{ color: "var(--vertigo-faint)" }}>(sin título)</em>}
            </span>
            {opt.tag && (
              <span className="text-[9px] font-bold uppercase tracking-[1.5px]" style={{ color: opt.color ?? "var(--vertigo-faint)" }}>{opt.tag}</span>
            )}
            {/* badges por tipo */}
            {kind === "FORMATO" && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(34,229,194,0.12)", color: "#22e5c2" }}>
                {opt.civsPerTeam ?? "?"} civs/equipo
              </span>
            )}
            {kind === "LLAVE" && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(216,161,63,0.12)", color: "#d8a13f" }}>
                {opt.llaveFormat ?? "?"}
              </span>
            )}
            {kind === "ANTIMETA" && mapPoolCount != null && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(124,58,237,0.12)", color: "var(--vertigo-purple-soft)" }}>
                {mapPoolCount} mapas propios
              </span>
            )}
            {kind === "MODO" && isAntimetaMode(opt) && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(255,46,126,0.12)", color: "#ff2e7e" }}>
                activa fase ANTIMETA
              </span>
            )}
          </div>
        </button>

        {/* orden */}
        <div className="flex flex-none flex-col" style={{ gap: 1 }}>
          <button type="button" onClick={() => onMove(-1)} disabled={disabled || idx === 0} title="Subir" style={{ cursor: "pointer", opacity: idx === 0 ? 0.25 : 1, background: "none", border: "none", padding: 0, lineHeight: 0 }}>
            <ChevronUp style={{ width: 13, height: 13, color: "var(--vertigo-muted)" }} />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={disabled || idx === total - 1} title="Bajar" style={{ cursor: "pointer", opacity: idx === total - 1 ? 0.25 : 1, background: "none", border: "none", padding: 0, lineHeight: 0 }}>
            <ChevronDown style={{ width: 13, height: 13, color: "var(--vertigo-muted)" }} />
          </button>
        </div>

        {/* switch activo */}
        <label
          title={active ? "Sale en la ruleta — clic para excluir" : "Excluida del sorteo — clic para incluir"}
          style={{ cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", flex: "none" }}
        >
          <input
            type="checkbox"
            checked={active}
            disabled={disabled}
            onChange={(e) => onWeight(e.currentTarget.checked ? Math.max(opt.weight ?? 1, 1) : 0)}
            style={{ display: "none" }}
          />
          <span className="relative inline-block rounded-full transition-all" style={{ width: 34, height: 18, background: active ? "#8b5cf6" : "rgba(255,255,255,0.12)" }}>
            <span className="absolute rounded-full bg-white" style={{ width: 14, height: 14, top: 2, left: active ? 18 : 2, transition: "left .18s" }} />
          </span>
        </label>

        {/* expandir / colapsar */}
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex-none"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
          title={open ? "Cerrar edición" : "Editar opción"}
        >
          <ChevronDown style={{ width: 14, height: 14, color: "var(--vertigo-muted)" }} />
        </button>
      </div>

      {/* Drawer de edición */}
      {open && (
        <div className="border-t px-4 pb-5 pt-4" style={{ borderColor: "var(--vertigo-line-soft)" }}>
          <OptionEditPanel opt={opt} kind={kind} disabled={disabled} maps={maps} art={art} onPatch={onPatch} />

          {/* Acciones destructivas / duplicar */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={onDuplicate} disabled={disabled} className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: 10, padding: "6px 12px" }}>
              <Copy style={{ width: 11, height: 11 }} />
              Duplicar
            </button>
            {!confirmDelete ? (
              <button type="button" onClick={onDelete} disabled={disabled} className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: 10, padding: "6px 12px", color: "var(--vertigo-danger)", borderColor: "rgba(239,68,68,0.3)" }}>
                <Trash2 style={{ width: 11, height: 11 }} />
                Eliminar
              </button>
            ) : (
              <>
                <button type="button" onClick={onDelete} disabled={disabled} className="vertigo-btn vertigo-btn-danger" style={{ fontSize: 10, padding: "6px 12px" }}>
                  <Trash2 style={{ width: 11, height: 11 }} />
                  Confirmar eliminación
                </button>
                <button type="button" onClick={onCancelDelete} className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: 10, padding: "6px 12px" }}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Panel de edición de una opción
// ─────────────────────────────────────────────────────────────

function OptionEditPanel({
  opt, kind, disabled, maps, art, onPatch,
}: {
  opt: EditorOption;
  kind: EditorList["kind"];
  disabled: boolean;
  maps: EditorOption[];
  art: string[];
  onPatch: (patch: Partial<EditorOption>) => void;
}) {
  const [artFilter, setArtFilter] = useState("");
  const visibleArt = useMemo(
    () => art.filter((a) => a.toLowerCase().includes(artFilter.toLowerCase())).slice(0, 40),
    [art, artFilter]
  );

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
      <label className="text-[9px] font-bold uppercase tracking-[2px]" style={{ color: "#b5adc4" }}>{label}</label>
      {node}
      {hint && <span className="text-[10px]" style={{ color: "var(--vertigo-faint)" }}>{hint}</span>}
    </div>
  );
  const inputStyle: React.CSSProperties = {
    background: "rgba(7,3,16,0.6)",
    border: "1px solid var(--vertigo-line)",
    borderRadius: 8,
    padding: "8px 12px",
    color: "var(--vertigo-text)",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Básicos */}
      <div className="flex flex-wrap gap-4">
        {field("Título", (
          <input value={opt.title ?? ""} disabled={disabled} onChange={(e) => onPatch({ title: e.target.value })} style={inputStyle} placeholder="MUERTE SÚBITA" />
        ))}
        {field("Tag (chip corto)", (
          <input value={opt.tag ?? ""} disabled={disabled} onChange={(e) => onPatch({ tag: e.target.value })} style={inputStyle} placeholder="TENSIÓN" />
        ))}
        {field("Peso", (
          <input
            type="number" min={0} max={99} value={opt.weight ?? 1} disabled={disabled}
            onChange={(e) => onPatch({ weight: Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)) })}
            style={{ ...inputStyle, width: 90, textAlign: "center" }}
          />
        ), "0 = excluida del sorteo")}
      </div>

      <div className="flex flex-wrap gap-4">
        {field("Tagline (frase de la card)", (
          <input value={opt.tagline ?? ""} disabled={disabled} onChange={(e) => onPatch({ tagline: e.target.value })} style={inputStyle} placeholder="El reloj no perdona." />
        ))}
        {field("Color de acento", (
          <div className="flex items-center gap-2">
            <input
              type="color" value={/^#[0-9a-fA-F]{6}$/.test(opt.color ?? "") ? opt.color! : "#b06bff"}
              disabled={disabled}
              onChange={(e) => onPatch({ color: e.target.value })}
              style={{ width: 42, height: 36, border: "1px solid var(--vertigo-line)", borderRadius: 8, background: "rgba(7,3,16,0.6)", cursor: "pointer", flex: "none" }}
            />
            <input value={opt.color ?? ""} disabled={disabled} onChange={(e) => onPatch({ color: e.target.value })} style={{ ...inputStyle, width: 110 }} placeholder="#b06bff" />
          </div>
        ))}
      </div>

      {field("Descripción", (
        <textarea value={opt.description ?? ""} disabled={disabled} onChange={(e) => onPatch({ description: e.target.value })} style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} placeholder="Qué pasa cuando sale esta opción." />
      ))}

      {field("Reglas (una por línea)", (
        <textarea
          value={(opt.rules ?? []).join("\n")}
          disabled={disabled}
          onChange={(e) => onPatch({ rules: e.target.value.split("\n").map((r) => r.trimStart()).filter((r, i, arr) => r !== "" || arr.length === 1) })}
          style={{ ...inputStyle, resize: "vertical", minHeight: 80, fontFamily: "inherit" }}
          placeholder={"Período de preparación limitado\nSin reconstruir edificios clave"}
        />
      ), "Se muestran en la pantalla de resultados del sorteo.")}

      {/* Extras por tipo */}
      {kind === "FORMATO" && (
        <div className="rounded-lg p-4" style={{ background: "rgba(34,229,194,0.05)", border: "1px solid rgba(34,229,194,0.2)" }}>
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px]" style={{ color: "#22e5c2" }}>Memotest de civs</div>
          <div className="flex flex-wrap items-center gap-3">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onPatch({ civsPerTeam: n })}
                className="rounded-lg border px-4 py-2 text-xs font-bold"
                style={{
                  borderColor: (opt.civsPerTeam ?? 1) === n ? "rgba(34,229,194,0.6)" : "var(--vertigo-line-soft)",
                  background: (opt.civsPerTeam ?? 1) === n ? "rgba(34,229,194,0.12)" : "rgba(7,3,16,0.6)",
                  color: (opt.civsPerTeam ?? 1) === n ? "#22e5c2" : "var(--vertigo-muted)",
                }}
              >
                {n} civ{ n > 1 ? "s" : ""} por equipo
              </button>
            ))}
            <span className="text-[10px]" style={{ color: "var(--vertigo-faint)" }}>
              Cuántas civs sortea el memotest para cada equipo con este formato.
            </span>
          </div>
        </div>
      )}

      {kind === "LLAVE" && (
        <div className="rounded-lg p-4" style={{ background: "rgba(216,161,63,0.05)", border: "1px solid rgba(216,161,63,0.2)" }}>
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px]" style={{ color: "#d8a13f" }}>Formato de la llave</div>
          <div className="flex flex-wrap items-center gap-3">
            {(["BO1", "BO3"] as const).map((f) => (
              <button
                key={f}
                type="button"
                disabled={disabled}
                onClick={() => onPatch({ llaveFormat: f })}
                className="rounded-lg border px-4 py-2 text-xs font-bold"
                style={{
                  borderColor: (opt.llaveFormat ?? "BO1") === f ? "rgba(216,161,63,0.6)" : "var(--vertigo-line-soft)",
                  background: (opt.llaveFormat ?? "BO1") === f ? "rgba(216,161,63,0.12)" : "rgba(7,3,16,0.6)",
                  color: (opt.llaveFormat ?? "BO1") === f ? "#d8a13f" : "var(--vertigo-muted)",
                }}
              >
                {f === "BO1" ? "BO1 — un partido" : "BO3 — al mejor de 3"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Arte / imagen */}
      <div className="flex flex-col gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[2px]" style={{ color: "#b5adc4" }}>Imagen de la card (arte de la ruleta)</label>
        <div className="flex flex-wrap items-center gap-3">
          {opt.img ? (
            <img src={opt.img} alt="" style={{ width: 120, height: 68, objectFit: "cover", borderRadius: 8, border: "1px solid var(--vertigo-line)" }} />
          ) : (
            <div className="flex items-center justify-center" style={{ width: 120, height: 68, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px dashed var(--vertigo-line-soft)" }}>
              <ImageOff style={{ width: 18, height: 18, color: "var(--vertigo-faint)" }} />
            </div>
          )}
          <input
            value={opt.img ?? ""}
            disabled={disabled}
            onChange={(e) => onPatch({ img: e.target.value })}
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
            placeholder="/modes/maps/mi-mapa.webp o https://…"
          />
        </div>
        {!disabled && (
          <details className="rounded-lg" style={{ border: "1px solid var(--vertigo-line-soft)", background: "rgba(7,3,16,0.4)" }}>
            <summary className="cursor-pointer px-3 py-2 text-[10px] font-bold uppercase tracking-[2px]" style={{ color: "var(--vertigo-muted)" }}>
              Elegir del arte existente ({art.length})
            </summary>
            <div className="px-3 pb-3">
              <input
                value={artFilter}
                onChange={(e) => setArtFilter(e.target.value)}
                placeholder="filtrar por nombre de archivo…"
                style={{ ...inputStyle, marginBottom: 10, fontSize: 12 }}
              />
              <div className="flex flex-wrap gap-2">
                {visibleArt.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => onPatch({ img: src })}
                    title={src}
                    style={{
                      width: 72, height: 44, padding: 0, cursor: "pointer",
                      borderRadius: 6, overflow: "hidden",
                      border: opt.img === src ? "2px solid rgba(212,175,55,0.7)" : "1px solid var(--vertigo-line-soft)",
                    }}
                  >
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>

      {/* mapPool — solo ANTIMETA */}
      {kind === "ANTIMETA" && (
        <div className="rounded-lg p-4" style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.25)" }}>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[2px]" style={{ color: "var(--vertigo-purple-soft)" }}>Pool de mapas propio</div>
          <p className="mb-3 text-[11px]" style={{ color: "var(--vertigo-faint)" }}>
            Cuando sale esta antimeta, el sorteo de MAPA usa solo estos mapas (con sus pesos). Si usás el pool global, entra cualquier mapa activo.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPatch({ mapPool: "global" })}
              className="rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1px]"
              style={{
                borderColor: opt.mapPool === "global" || opt.mapPool == null ? "rgba(124,58,237,0.6)" : "var(--vertigo-line-soft)",
                background: opt.mapPool === "global" || opt.mapPool == null ? "rgba(124,58,237,0.15)" : "rgba(7,3,16,0.6)",
                color: opt.mapPool === "global" || opt.mapPool == null ? "var(--vertigo-purple-soft)" : "var(--vertigo-muted)",
              }}
            >
              Usar pool global
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPatch({ mapPool: maps.length ? maps.filter((m) => (m.weight ?? 1) > 0) : [] })}
              className="rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1px]"
              style={{
                borderColor: Array.isArray(opt.mapPool) ? "rgba(124,58,237,0.6)" : "var(--vertigo-line-soft)",
                background: Array.isArray(opt.mapPool) ? "rgba(124,58,237,0.15)" : "rgba(7,3,16,0.6)",
                color: Array.isArray(opt.mapPool) ? "var(--vertigo-purple-soft)" : "var(--vertigo-muted)",
              }}
            >
              Pool propio ({Array.isArray(opt.mapPool) ? opt.mapPool.length : 0})
            </button>
          </div>
          {Array.isArray(opt.mapPool) && (
            <div className="flex flex-wrap gap-2">
              {maps.map((m) => {
                const inPool = (opt.mapPool as EditorOption[]).some((p) => p.id === m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const cur = opt.mapPool as EditorOption[];
                      onPatch({
                        mapPool: inPool ? cur.filter((p) => p.id !== m.id) : [...cur, m],
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px]"
                    style={{
                      borderColor: inPool ? "rgba(34,229,194,0.5)" : "var(--vertigo-line-soft)",
                      background: inPool ? "rgba(34,229,194,0.1)" : "rgba(7,3,16,0.6)",
                      color: inPool ? "#22e5c2" : "var(--vertigo-muted)",
                      opacity: (m.weight ?? 1) > 0 || inPool ? 1 : 0.4,
                    }}
                  >
                    {inPool ? <Check style={{ width: 10, height: 10 }} /> : <X style={{ width: 10, height: 10 }} />}
                    {m.title || m.id}
                  </button>
                );
              })}
              {(opt.mapPool as EditorOption[]).length === 0 && (
                <span className="text-[11px]" style={{ color: "var(--vertigo-danger)" }}>
                  Pool propio vacío: el sorteo de MAPA con esta antimeta revienta. Tocá mapas para incluirlos.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {kind === "MODO" && isAntimetaMode(opt) && (
        <p className="text-[11px]" style={{ color: "#ff2e7e" }}>
          ⓘ El título o el id de este modo contiene «antimeta»: cuando salga, la ruleta sortea una ANTIMETA después (segunda fase).
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Panel de presentación
// ─────────────────────────────────────────────────────────────

function PresentationPanel({
  value, disabled, onChange,
}: {
  value: Presentation;
  disabled: boolean;
  onChange: (p: Presentation) => void;
}) {
  const row = (label: string, node: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] font-bold uppercase tracking-[2px]" style={{ color: "#b5adc4" }}>{label}</label>
      {node}
      {hint && <span className="text-[10px]" style={{ color: "var(--vertigo-faint)" }}>{hint}</span>}
    </div>
  );

  const toggle = (checked: boolean, onToggle: () => void, labelOn: string, labelOff: string) => (
    <label className="inline-flex cursor-pointer items-center gap-2" style={{ opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} style={{ display: "none" }} />
      <span className="relative inline-block rounded-full transition-all" style={{ width: 34, height: 18, background: checked ? "#8b5cf6" : "rgba(255,255,255,0.12)" }}>
        <span className="absolute rounded-full bg-white" style={{ width: 14, height: 14, top: 2, left: checked ? 18 : 2, transition: "left .18s" }} />
      </span>
      <span className="text-xs" style={{ color: "var(--vertigo-muted)" }}>{checked ? labelOn : labelOff}</span>
    </label>
  );

  const slider = (val: number, onInput: (v: number) => void) => (
    <div className="flex items-center gap-3">
      <input
        type="range" min={0} max={1} step={0.05} value={val} disabled={disabled}
        onChange={(e) => onInput(parseFloat(e.target.value))}
        style={{ width: 180, accentColor: "#8b5cf6" }}
      />
      <span className="w-10 text-xs font-bold" style={{ color: "var(--vertigo-text)" }}>{Math.round(val * 100)}%</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl p-5" style={{ background: "rgba(13,9,19,0.6)", border: "1px solid var(--vertigo-line-soft)" }}>
        <div className="flex flex-col gap-5">
          {row("Música de fondo", (
            <div className="flex flex-wrap items-center gap-4">
              {toggle(value.music.enabled, () => onChange({ ...value, music: { ...value.music, enabled: !value.music.enabled } }), "On", "Off")}
              {slider(value.music.volume, (v) => onChange({ ...value, music: { ...value.music, volume: v } }))}
            </div>
          ), "Tema «Iron Banner Rise» mientras gira la ruleta.")}
          {row("Sonidos del giro", (
            <div className="flex flex-wrap items-center gap-4">
              {toggle(value.sounds.enabled, () => onChange({ ...value, sounds: { ...value.sounds, enabled: !value.sounds.enabled } }), "On", "Off")}
              {slider(value.sounds.volume, (v) => onChange({ ...value, sounds: { ...value.sounds, volume: v } }))}
            </div>
          ), "Ticks mientras gira + gong al parar en cada opción.")}
          {row("Fondo de la escena", (
            <div className="flex flex-wrap gap-2">
              {(["fondo", "vortex"] as const).map((bg) => (
                <button
                  key={bg}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, background: bg })}
                  className="rounded-lg border px-4 py-2 text-xs font-bold"
                  style={{
                    borderColor: value.background === bg ? "rgba(212,175,55,0.5)" : "var(--vertigo-line-soft)",
                    background: value.background === bg ? "rgba(124,58,237,0.18)" : "rgba(7,3,16,0.6)",
                    color: value.background === bg ? "#fff" : "var(--vertigo-muted)",
                  }}
                >
                  {bg === "fondo" ? "Castillo (fondo)" : "Vórtice"}
                </button>
              ))}
            </div>
          ))}
          {row("Sortear LLAVE en la partida 1", (
            toggle(value.firstRound, () => onChange({ ...value, firstRound: !value.firstRound }), "Sí — la ruleta sortea BO1/BO3 después del mapa", "No — no se sortea llave")
          ), "firstRound: gira una fase extra (DEATHMATCH/BO3) solo en el primer sorteo de la llave.")}
          {row("Cards épicas", (
            toggle(value.epicCards, () => onChange({ ...value, epicCards: !value.epicCards }), "On", "Off")
          ), "Efectos visuales extra en las cards de la ruleta.")}
        </div>
      </div>
    </div>
  );
}
