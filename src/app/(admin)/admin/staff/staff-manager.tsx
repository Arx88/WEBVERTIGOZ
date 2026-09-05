"use client";

/**
 * StaffManager — buscar + filtrar el roster sin recargar.
 * Envuelve StaffTable (lógica de quitar intacta).
 */

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import StaffTable, { type StaffMember } from "./staff-table";

export default function StaffManager({
  staff, isSuperAdmin, myEmail,
}: {
  staff: StaffMember[];
  isSuperAdmin: boolean;
  myEmail: string;
}) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"all" | "max" | "admin">("all");

  const filtered = useMemo(() => {
    const hay = q.trim().toLowerCase();
    return staff.filter((s) => {
      if (filtro === "max" && s.role !== "super_admin") return false;
      if (filtro === "admin" && s.role !== "admin") return false;
      if (!hay) return true;
      return `${s.display_name ?? ""} ${s.email}`.toLowerCase().includes(hay);
    });
  }, [staff, q, filtro]);

  const maxes = staff.filter((s) => s.role === "super_admin").length;
  const admins = staff.length - maxes;

  return (
    <div>
      <div className="staff-toolbar">
        <label className="staff-search">
          <Search size={13} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email…" aria-label="Buscar staff" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Limpiar"><X size={12} /></button>}
        </label>
        <div className="staff-pills" role="group" aria-label="Filtrar por rol">
          <button type="button" className={`staff-pill ${filtro === "all" ? "is-active" : ""}`} onClick={() => setFiltro("all")}>
            Todos <b>{staff.length}</b>
          </button>
          <button type="button" className={`staff-pill ${filtro === "max" ? "is-active" : ""}`} onClick={() => setFiltro(filtro === "max" ? "all" : "max")}>
            MAX <b>{maxes}</b>
          </button>
          <button type="button" className={`staff-pill ${filtro === "admin" ? "is-active" : ""}`} onClick={() => setFiltro(filtro === "admin" ? "all" : "admin")}>
            Admins <b>{admins}</b>
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="vertigo-card"><div className="vertigo-empty">
          <div className="vertigo-empty-title">Sin resultados</div>
          <p className="vertigo-empty-desc">Probá con otro nombre o limpiá el filtro.</p>
        </div></div>
      ) : (
        <StaffTable staff={filtered} isSuperAdmin={isSuperAdmin} myEmail={myEmail} />
      )}
    </div>
  );
}
