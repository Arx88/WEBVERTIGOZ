"use client";

/**
 * Uploader del handbook PDF (bucket privado `handbook`).
 * El action guarda el PATH en la edición; la URL firmada se genera al leer.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { uploadHandbookAction } from "@/server/actions/edicion";

export default function HandbookUploader({ editionId }: { editionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("edition_id", editionId);
    setPending(true);
    setError(null);
    setOk(false);
    const res = await uploadHandbookAction(fd);
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo subir el handbook.");
      return;
    }
    setOk(true);
    setFileName(null);
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="vertigo-field">
        <label>Archivo PDF</label>
        <input
          type="file"
          name="file"
          accept="application/pdf,.pdf"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="!h-auto !py-3 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-[var(--vertigo-purple)] file:text-white file:font-semibold file:text-xs file:cursor-pointer file:uppercase file:tracking-wider"
        />
        <p className="text-[10px] text-[var(--vertigo-faint)] mt-1">
          PDF hasta 20 MB. Reemplaza el handbook actual de esta edición.
        </p>
      </div>

      {error && (
        <p className="text-xs text-[var(--vertigo-danger)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {ok && (
        <p className="text-xs text-[var(--vertigo-success)]">
          ✓ Handbook subido. El wizard ya sirve la versión nueva.
        </p>
      )}

      <div className="vertigo-action-bar">
        <button type="submit" className="vertigo-btn vertigo-btn-primary" disabled={pending}>
          <Upload style={{ width: 14, height: 14 }} />
          {pending ? "Subiendo…" : fileName ? `Subir «${fileName}»` : "Subir handbook"}
        </button>
      </div>
    </form>
  );
}
