"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Refresco en vivo para la página admin del partido.
 *
 * La página es server component: sin esto, lo que cambia en la DB (un capitán
 * que confirma READY, un resultado cargado, una extensión de ventana) solo se
 * ve al refrescar a mano. Este componente escucha cambios del match y hace
 * router.refresh() para que el server re-renderice con datos frescos.
 */
export default function MatchLiveRefresher({ matchId }: { matchId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 350);
    };

    const channel = supabase
      .channel(`admin-match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match", filter: `id=eq.${matchId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_game", filter: `match_id=eq.${matchId}` },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [matchId, router]);

  return null;
}
