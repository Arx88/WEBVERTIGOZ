import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SIGN_TTL_SECONDS = 60 * 10; // 10 minutos alcanza para descargar

/**
 * GET /api/replays/rec?game_id=<match_game.id>
 *
 * Link estable de descarga del .aoe2record archivado: firma una URL corta
 * contra el bucket privado `replays` y redirige. Así el botón de descarga
 * en la UI no depende de una signed URL embebida que expira.
 */
export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("game_id");
  if (!gameId) {
    return NextResponse.json({ error: "game_id requerido" }, { status: 400 });
  }

  try {
    const service = getSupabaseServiceRole() as any;

    const { data: game } = await service
      .from("match_game")
      .select("rec_storage_path")
      .eq("id", gameId)
      .maybeSingle();

    if (!game?.rec_storage_path) {
      return NextResponse.json(
        { error: "Esta partida no tiene .aoe2record archivado" },
        { status: 404 }
      );
    }

    const { data } = await service.storage
      .from("replays")
      .createSignedUrl(game.rec_storage_path, SIGN_TTL_SECONDS, {
        download: `partida-${gameId}.aoe2record`,
      });

    if (!data?.signedUrl) {
      return NextResponse.json({ error: "No se pudo firmar la descarga" }, { status: 500 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch {
    return NextResponse.json({ error: "No se pudo descargar el replay" }, { status: 500 });
  }
}
