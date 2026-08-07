import { NextResponse } from "next/server";
import { promises as dns } from "dns";
import net from "net";

export async function GET() {
  const tests: Array<{ name: string; ok: boolean; detail?: string }> = [];

  // Para cada región, probar conexión TCP al pooler en puerto 5432 y 6543
  const regions = ["us-east-1", "us-west-1", "eu-west-1", "eu-central-1", "ap-southeast-1"];

  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    for (const port of [5432, 6543]) {
      const name = `tcp:${host}:${port}`;
      await new Promise<void>((resolve) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          tests.push({ name, ok: false, detail: "timeout 5s" });
          resolve();
        }, 5000);
        socket.connect(port, host, () => {
          clearTimeout(timeout);
          socket.destroy();
          tests.push({ name, ok: true });
          resolve();
        });
        socket.on("error", (err) => {
          clearTimeout(timeout);
          tests.push({ name, ok: false, detail: err.message.slice(0, 80) });
          resolve();
        });
      });
    }
  }

  return NextResponse.json({ tests });
}
