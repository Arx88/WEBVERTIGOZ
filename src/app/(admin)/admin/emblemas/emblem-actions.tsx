"use client";

/**
 * Acciones por emblema en la grilla de /admin/emblemas:
 * activar/desactivar y eliminar (con confirm; el action rechaza borrar
 * emblemas en uso por equipos).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleEmblemAction, deleteEmblemAction } from "@/server/actions/edicion";

const btnCls =
  "text-[10px] uppercase tracking-wider rounded-md border px-2 py-1 transition-colors disabled:opacity-50 cursor-pointer";

export default function EmblemCardActions({
  emblemId,
  isActive,
}: {
  emblemId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"toggle" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "toggle" | "delete") {
    if (kind === "delete" && !window.confirm("¿Eliminar este emblema definitivamente?")) return;
    setPending(kind);
    setError(null);
    const res = kind === "toggle"
      ? await toggleEmblemAction(emblemId)
      : await deleteEmblemAction(emblemId);
    setPending(null);
    if (!res.ok) {
      setError(res.error ?? "Error");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending != null}
          onClick={() => run("toggle")}
          className={`${btnCls} ${
            isActive
              ? "border-[var(--vertigo-line-soft)] text-[var(--vertigo-muted)] hover:text-[var(--vertigo-text)]"
              : "border-[var(--vertigo-success)] text-[var(--vertigo-success)]"
          }`}
        >
          {pending === "toggle" ? "…" : isActive ? "Desactivar" : "Activar"}
        </button>
        <button
          type="button"
          disabled={pending != null}
          onClick={() => run("delete")}
          className={`${btnCls} border-[rgba(239,68,68,0.4)] text-[var(--vertigo-danger)]`}
        >
          {pending === "delete" ? "…" : "Eliminar"}
        </button>
      </div>
      {error && (
        <p className="text-[10px] text-[var(--vertigo-danger)] text-center leading-snug">{error}</p>
      )}
    </div>
  );
}
