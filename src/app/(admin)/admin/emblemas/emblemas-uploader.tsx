"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";

export default function EmblemasUploader() {
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    // Validar tipo
    if (!["image/svg+xml", "image/png"].includes(f.type)) {
      setError("Solo se aceptan SVG o PNG.");
      setFile(null);
      setPreview(null);
      return;
    }

    // Validar tamaño (max 2MB)
    if (f.size > 2 * 1024 * 1024) {
      setError("El archivo no puede superar 2MB.");
      setFile(null);
      setPreview(null);
      return;
    }

    setError(null);
    setFile(f);

    // Auto-generar nombre si vacío
    if (!name) {
      const baseName = f.name.replace(/\.(svg|png)$/i, "");
      setName(baseName);
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name) {
      setError("Nombre y archivo son requeridos.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Subir archivo al bucket 'emblems' via /api/upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "emblems");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: "Error de upload" }));
        throw new Error(err.error || "Error al subir archivo");
      }

      const uploadData = await uploadRes.json();

      // Crear registro en tabla emblem
      const createRes = await fetch("/api/admin/emblemas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          key: name.trim().toLowerCase().replace(/\s+/g, "-"),
          image_url: uploadData.url,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({ error: "Error al crear emblema" }));
        throw new Error(err.error || "Error al crear emblema");
      }

      setSuccess(`Emblema "${name}" subido correctamente.`);
      setName("");
      setFile(null);
      setPreview(null);

      // Recargar página para ver el nuevo emblema
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section style={{ marginBottom: "32px" }}>
      <h2 className="vertigo-subtitle" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Upload size={14} /> Subir nuevo emblema
      </h2>
      <form onSubmit={handleUpload} style={{
        padding: "20px",
        background: "var(--vertigo-panel)",
        borderRadius: "10px",
        border: "1px solid var(--vertigo-line)",
        display: "grid",
        gridTemplateColumns: "auto 1fr 1fr auto",
        gap: "16px",
        alignItems: "center",
      }}>
        {/* Preview */}
        <div style={{
          width: "80px",
          height: "80px",
          background: "var(--vertigo-bg)",
          borderRadius: "10px",
          border: "1px dashed var(--vertigo-line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          {preview ? (
            <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <span style={{ color: "var(--vertigo-muted)", fontSize: "11px" }}>Sin preview</span>
          )}
        </div>

        {/* Nombre */}
        <div>
          <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Nombre del emblema</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: León Real"
            style={{
              width: "100%",
              padding: "10px",
              background: "var(--vertigo-bg)",
              border: "1px solid var(--vertigo-line)",
              borderRadius: "6px",
              color: "var(--vertigo-text)",
              fontSize: "13px",
            }}
          />
        </div>

        {/* File input */}
        <div>
          <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Archivo (SVG o PNG, máx 2MB)</label>
          <input
            type="file"
            accept="image/svg+xml,image/png"
            onChange={handleFileChange}
            style={{
              width: "100%",
              padding: "8px",
              background: "var(--vertigo-bg)",
              border: "1px solid var(--vertigo-line)",
              borderRadius: "6px",
              color: "var(--vertigo-text)",
              fontSize: "12px",
            }}
          />
        </div>

        {/* Submit */}
        <div>
          <button
            type="submit"
            disabled={uploading || !file || !name}
            className="vertigo-btn"
            style={{
              background: "var(--vertigo-purple)",
              color: "#fff",
              opacity: uploading || !file || !name ? 0.5 : 1,
            }}
          >
            {uploading ? (
              <><Loader2 size={14} style={{ display: "inline", marginRight: "6px", animation: "spin 1s linear infinite" }} /> Subiendo...</>
            ) : (
              <><Upload size={14} style={{ display: "inline", marginRight: "6px" }} /> Subir</>
            )}
          </button>
        </div>

        {error && (
          <div style={{ gridColumn: "1 / -1", padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid var(--vertigo-danger)", borderRadius: "6px", color: "var(--vertigo-danger)", fontSize: "12px" }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ gridColumn: "1 / -1", padding: "8px 12px", background: "rgba(34,197,94,0.1)", border: "1px solid var(--vertigo-success)", borderRadius: "6px", color: "var(--vertigo-success)", fontSize: "12px" }}>
            {success}
          </div>
        )}
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
