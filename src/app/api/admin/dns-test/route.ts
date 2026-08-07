import { NextResponse } from "next/server";

export async function GET() {
  const tests: any[] = [];

  // Test 1: DNS resolution
  const hostnames = [
    "db.tomlvgzwleolsxksiygs.supabase.co",
    "aws-0-us-east-1.pooler.supabase.com",
    "aws-0-eu-west-1.pooler.supabase.com",
    "tomlvgzwleolsxksiygs.supabase.co",
  ];

  for (const hostname of hostnames) {
    try {
      const { promises } = await import("dns");
      const records = await promises.resolve(hostname);
      tests.push({ hostname, ok: true, records });
    } catch (e: any) {
      tests.push({ hostname, ok: false, error: e.message });
    }
  }

  // Test 2: TCP connect to postgres
  const net = await import("net");
  for (const host of ["db.tomlvgzwleolsxksiygs.supabase.co:5432"]) {
    const [h, portStr] = host.split(":");
    const port = parseInt(portStr, 10);
    await new Promise<void>((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        tests.push({ tcp: host, ok: false, error: "timeout 5s" });
        resolve();
      }, 5000);
      socket.connect(port, h, () => {
        clearTimeout(timeout);
        socket.destroy();
        tests.push({ tcp: host, ok: true });
        resolve();
      });
      socket.on("error", (err: any) => {
        clearTimeout(timeout);
        tests.push({ tcp: host, ok: false, error: err.message });
        resolve();
      });
    });
  }

  return NextResponse.json({ tests });
}
