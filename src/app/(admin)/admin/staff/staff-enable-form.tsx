"use client";

/**
 * Form único de alta de admin por email (/admin/staff).
 * El server rechaza cualquier intento de quien no sea super_admin — acá
 * solo se deshabilita la UI si no lo sos (la autoridad real vive server-side).
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, ShieldPlus } from "lucide-react";
import { setAdminRoleAction } from "@/server/actions/ruleta";

export default function StaffEnableForm({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("role", "admin");
    startTransition(async () => {
      const r = await setAdminRoleAction(fd);
      setMsg(
        r.ok
          ? { ok: true, text: "Admin habilitado. Ya puede entrar al panel con su email." }
          : { ok: false, text: r.error ?? "No se pudo completar." }
      );
      if (r.ok) {
        formRef.current?.reset();
        router.refresh();
      }
    });
  };

  if (!isSuperAdmin) {
    return (
      <div className="vertigo-card staff-quiet">
        <ShieldPlus style={{ width: 15, height: 15, color: "var(--vertigo-faint)", flex: "none" }} />
        <p>Solo el ADMIN MAX puede habilitar administradores. Estás en modo lectura.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="vertigo-card staff-form">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg px-3 py-2.5"
          style={{ border: "1px solid var(--vertigo-line)", background: "rgba(7,3,16,0.6)" }}
        >
          <Mail style={{ width: 14, height: 14, color: "var(--vertigo-faint)", flex: "none" }} />
          <input
            name="email"
            type="email"
            required
            disabled={!isSuperAdmin || pending}
            placeholder="persona@email.com"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--vertigo-text)" }}
          />
        </div>
        <button
          type="submit"
          disabled={!isSuperAdmin || pending}
          className="vertigo-btn vertigo-btn-primary"
          style={{ opacity: isSuperAdmin ? 1 : 0.5 }}
          title={isSuperAdmin ? "Habilitar como admin" : "Solo el ADMIN MAX puede habilitar admins"}
        >
          {pending ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <ShieldPlus style={{ width: 13, height: 13 }} />}
          Habilitar como admin
        </button>
      </div>
      <p className="vertigo-hint mt-3">
        Si el email ya tiene cuenta en el sitio (capitán, caster, espectador), se le asigna el rol de admin sin perder
        su historial. Si es un email nuevo, se crea su acceso: entra con «Olvidé mi contraseña» para elegir una.
      </p>
      {msg && (
        <p
          className="mt-3 rounded-md px-3 py-2 text-xs"
          style={{
            border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            background: msg.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            color: msg.ok ? "var(--vertigo-success)" : "var(--vertigo-danger)",
          }}
        >
          {msg.text}
        </p>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  );
}
