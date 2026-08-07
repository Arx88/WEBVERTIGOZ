import { NextResponse } from "next/server";
import { promises as dns } from "dns";
import net from "net";

export async function GET() {
  const tests: Array<{ name: string; ok: boolean; detail?: string }> = [];

  // Test DNS resolution
  const hostnames = [
    "db.tomlvgzwleolsxksiygs.supabase.co",
    "aws-0-us-east-1.pooler.supabase.com",
    "aws-0-eu-west-1.pooler.supabase.com",
    "tomlvgzwleolsxksiygs.supabase.co",
  ];

  for (const hostname of hostnames) {
    try {
      const records = await dns.resolve(hostname);
      tests.push({ name: `dns:${hostname}`, ok: true, detail: JSON.stringify(records) });
    } catch (e) {
      tests.push({
        name: `dns:${hostname}`,
        ok: false,
        detail: e instanceof Error ? e.message : "error",
      });
    }
  }

  // Test TCP connect to postgres
  await new Promise<void>((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      tests.push({ name: "tcp:db.tomlvgzwleolsxksiygs.supabase.co:5432", ok: false, detail: "timeout 5s" });
      resolve();
    }, 5000);
    socket.connect(5432, "db.tomlvgzwleolsxksiygs.supabase.co", () => {
      clearTimeout(timeout);
      socket.destroy();
      tests.push({ name: "tcp:db.tomlvgzwleolsxksiygs.supabase.co:5432", ok: true });
      resolve();
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      tests.push({
        name: "tcp:db.tomlvgzwleolsxksiygs.supabase.co:5432",
        ok: false,
        detail: err.message,
      });
      resolve();
    });
  });

  return NextResponse.json({ tests });
}
