"use client";

/**
 * Toggle global de sonido del sitio. Vive en el nav (header-right).
 * Persistido en localStorage; sincronizado entre pestañas vía evento
 * custom de sounds.ts.
 */

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundMuted, setSoundMuted, onSoundMuteChange, playSound } from "@/lib/sounds";

export default function SoundToggle() {
  // null = aún no sabemos (evita hydration mismatch: primer render idéntico)
  const [muted, setMuted] = useState<boolean | null>(null);

  useEffect(() => {
    setMuted(isSoundMuted());
    return onSoundMuteChange(setMuted);
  }, []);

  const toggle = () => {
    const next = !(muted ?? false);
    setMuted(next);
    setSoundMuted(next);
    if (!next) playSound("toggle-on"); // motivo ascendente al reactivar
  };

  const isMuted = muted ?? false;

  return (
    <button
      onClick={toggle}
      data-sound-off
      aria-pressed={!isMuted}
      aria-label={isMuted ? "Activar sonidos del sitio" : "Silenciar sonidos del sitio"}
      title={isMuted ? "Sonidos silenciados" : "Sonidos activados"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(10,0,17,0.55)",
        color: isMuted ? "rgba(255,255,255,0.38)" : "#d4af37",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = isMuted
          ? "rgba(255,255,255,0.3)"
          : "rgba(212,175,55,0.55)";
        e.currentTarget.style.color = isMuted ? "rgba(255,255,255,0.6)" : "#f0d478";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
        e.currentTarget.style.color = isMuted ? "rgba(255,255,255,0.38)" : "#d4af37";
      }}
    >
      {isMuted ? (
        <VolumeX style={{ width: 15, height: 15 }} />
      ) : (
        <Volume2 style={{ width: 15, height: 15 }} />
      )}
    </button>
  );
}
