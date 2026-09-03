"use client";

/**
 * Tabla de staff de /admin/staff.
 *
 * Cada admin (no MAX) tiene el botón "Quitar admin" DIRECTO en su fila —
 * sin input de email manual. Confirmación en 2 pasos inline (el botón
 * cambia a "Confirmar" en rojo) para que no haya clicks accidentales.
 * La autoridad real vive en la action (solo super_admin).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Lock, Mail, Shield, ShieldOff } from "lucide-react";
import { setAdminRoleAction } from "@/server/actions/ruleta";

export interface StaffMember {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "super_admin";
  created_at: string;
}

export default function StaffTable({
  staff,
  isSuperAdmin,
  myEmail,
}: {
  staff: StaffMember[];
  isSuperAdmin: boolean;
  myEmail: string;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const quitar = (email: string, id: string) => {
    setRowError(null);
    setPendingId(id);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("role", "owner");
    startTransition(async () => {
      const r = await setAdminRoleAction(fd);
      setPendingId(null);
      setConfirmId(null);
      if (!r.ok) {
        setRowError({ id, text: r.error ?? "No se pudo quitar el rol." });
        return;
      }
      router.refresh();
    });
  };

  if (staff.length === 0) {
    return <div className="ad-empty">No hay staff registrado todavía.</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {staff.map((s) => {
        const isMax = s.role === "super_admin";
        const isMe = s.email === myEmail;
        const confirming = confirmId === s.id;
        const busy = pendingId === s.id;
        return (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3.5"
            style={{
              background: "rgba(13,9,19,0.6)",
              border: `1px solid ${isMax ? "rgba(251,191,36,0.35)" : "var(--vertigo-line-soft)"}`,
            }}
          >
            {/* Avatar */}
            <div
              className="flex flex-none items-center justify-center rounded-full"
              style={{
                width: 36, height: 36, fontSize: 14, fontWeight: 700,
                background: isMax ? "rgba(251,191,36,0.12)" : "rgba(124,58,237,0.15)",
                color: isMax ? "#fbbf24" : "var(--vertigo-purple-soft)",
              }}
            >
              {(s.display_name ?? s.email ?? "?").charAt(0).toUpperCase()}
            </div>

            {/* Identidad */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold" style={{ color: "var(--vertigo-text)" }}>
                  {s.display_name || s.email.split("@")[0]}
                </span>
                {isMe && (
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[1px]" style={{ background: "rgba(124,58,237,0.2)", color: "var(--vertigo-purple-soft)" }}>
                    vos
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--vertigo-faint)" }}>
                <Mail style={{ width: 11, height: 11, flex: "none" }} />
                <span className="truncate">{s.email}</span>
              </div>
            </div>

            {/* Rol */}
            <span
              className="flex flex-none items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[1.5px]"
              style={{
                background: isMax ? "rgba(251,191,36,0.12)" : "rgba(124,58,237,0.15)",
                color: isMax ? "#fbbf24" : "var(--vertigo-purple-soft)",
              }}
            >
              {isMax ? <Crown style={{ width: 11, height: 11 }} /> : <Shield style={{ width: 11, height: 11 }} />}
              {isMax ? "ADMIN MAX" : "Admin"}
            </span>

            {/* Acciones */}
            {isMax ? (
              <span
                className="flex flex-none items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1px]"
                style={{ color: "var(--vertigo-faint)" }}
                title="Protegido — los ADMIN MAX no se pueden modificar desde el panel"
              >
                <Lock style={{ width: 12, height: 12 }} />
                Protegido
              </span>
            ) : !isSuperAdmin ? (
              <span className="flex-none text-[10px]" style={{ color: "var(--vertigo-faint)" }} title="Solo el ADMIN MAX gestiona staff">
                —
              </span>
            ) : !confirming ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => { setRowError(null); setConfirmId(s.id); }}
                className="vertigo-btn vertigo-btn-ghost flex-none"
                style={{ fontSize: 10, padding: "6px 12px", color: "var(--vertigo-danger)", borderColor: "rgba(239,68,68,0.3)" }}
                title="Quitar rol de admin (vuelve a ser dueño de equipo)"
              >
                <ShieldOff style={{ width: 11, height: 11 }} />
                Quitar admin
              </button>
            ) : (
              <span className="flex flex-none items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => quitar(s.email, s.id)}
                  className="vertigo-btn vertigo-btn-danger"
                  style={{ fontSize: 10, padding: "6px 12px" }}
                >
                  {busy ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <ShieldOff style={{ width: 11, height: 11 }} />}
                  Confirmar: quitar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setConfirmId(null); setRowError(null); }}
                  className="vertigo-btn vertigo-btn-ghost"
                  style={{ fontSize: 10, padding: "6px 12px" }}
                >
                  Cancelar
                </button>
              </span>
            )}

            {/* Error de fila */}
            {rowError?.id === s.id && (
              <span className="w-full text-xs" style={{ color: "var(--vertigo-danger)" }}>{rowError.text}</span>
            )}
          </div>
        );
      })}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
