import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Eye, Twitch, Youtube, Video } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CastersPage() {
  const supabase = (await getSupabaseServer()) as any;

  const { data: casters } = (await supabase
    .from("caster")
    .select("id, name, channel_url, platform, tier, bio")
    .order("tier", { ascending: true })
    .order("name", { ascending: true })) as { data: any[] };

  const tierLabels: Record<string, { label: string; color: string }> = {
    official: { label: "OFICIAL", color: "var(--vertigo-purple)" },
    secondary: { label: "SECUNDARIO", color: "var(--vertigo-warning)" },
    community: { label: "COMUNIDAD", color: "var(--vertigo-muted)" },
  };

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <div style={{ marginBottom: "32px" }}>
        <Link href="/" style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver al inicio
        </Link>
        <div style={{ marginTop: "12px" }}>
          <span style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", letterSpacing: "2px", textTransform: "uppercase" }}>
            VÉRTIGO Cup
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            Casters
          </h1>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px", marginTop: "8px" }}>
            {casters?.length ?? 0} casters registrados
          </p>
        </div>
      </div>

      {!casters || casters.length === 0 ? (
        <div style={{
          padding: "40px",
          background: "var(--vertigo-panel)",
          borderRadius: "12px",
          textAlign: "center",
          border: "1px solid var(--vertigo-line)",
        }}>
          <h2 style={{ fontSize: "20px", color: "var(--vertigo-text)", marginBottom: "8px" }}>
            No hay casters registrados
          </h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            Los casters se agregan desde el panel admin.
          </p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
        }}>
          {casters.map((c) => {
            const tier = tierLabels[c.tier] ?? tierLabels.community;
            const PlatformIcon = c.platform === "twitch" ? Twitch : c.platform === "youtube" ? Youtube : Video;
            return (
              <div
                key={c.id}
                style={{
                  padding: "20px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "12px",
                  border: `1px solid ${tier.color}55`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "var(--vertigo-bg)",
                      border: `2px solid ${tier.color}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: tier.color,
                    }}>
                      <PlatformIcon size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700 }}>{c.name}</div>
                      <span style={{
                        fontSize: "9px",
                        padding: "2px 6px",
                        background: `${tier.color}22`,
                        color: tier.color,
                        borderRadius: "999px",
                        fontWeight: 700,
                        letterSpacing: "1px",
                      }}>
                        {tier.label}
                      </span>
                    </div>
                  </div>
                </div>
                {c.bio && (
                  <p style={{ fontSize: "12px", color: "var(--vertigo-muted)", marginBottom: "12px", lineHeight: 1.5 }}>
                    {c.bio}
                  </p>
                )}
                {c.channel_url && (
                  <a
                    href={c.channel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                      color: "var(--vertigo-purple-soft)",
                      textDecoration: "none",
                    }}
                  >
                    <Eye size={12} />
                    Ver canal
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
