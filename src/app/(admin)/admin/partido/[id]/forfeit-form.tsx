"use client";

import { AlertTriangle } from "lucide-react";

export default function ForfeitForm({
  matchId,
  action,
}: {
  matchId: string;
  action: (formData: FormData) => void;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("¿Marcar W.O.? El otro equipo avanza.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="match_id" value={matchId} />
      <button type="submit" className="vertigo-btn vertigo-btn-danger">
        <AlertTriangle style={{ width: 14, height: 14 }} /> W.O.
      </button>
    </form>
  );
}
