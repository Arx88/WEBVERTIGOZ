import { NextRequest, NextResponse } from "next/server";
import { getChannelStatuses, type ChannelRef } from "@/lib/streams";

/**
 * GET /api/streams/live?twitch=a,b&kick=c,d
 * Estado "en vivo" de canales de casters. Público: es el mismo dato que
 * muestra la página de casters; la UI lo re-polluea cada 90s.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refs: ChannelRef[] = [];
  const add = (platform: "twitch" | "kick", raw: string | null) => {
    for (const ch of (raw ?? "").split(",")) {
      const c = ch.trim().toLowerCase();
      if (c) refs.push({ key: `${platform}:${c}`, platform, channel: c });
    }
  };
  add("twitch", req.nextUrl.searchParams.get("twitch"));
  add("kick", req.nextUrl.searchParams.get("kick"));

  const statuses = await getChannelStatuses(refs);
  return NextResponse.json(statuses, {
    headers: { "Cache-Control": "public, max-age=15" },
  });
}
