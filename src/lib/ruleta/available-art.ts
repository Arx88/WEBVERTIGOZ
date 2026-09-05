import fs from "fs";
import path from "path";

/**
 * Arte disponible para las opciones de la ruleta (public/modes).
 * Server-only: lee el filesystem del server. Extraído de
 * /admin/ruletas para compartirlo con el Stream View.
 */

export function readAvailableArt(): string[] {
  const root = path.join(process.cwd(), "public", "modes");
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      } else if (/\.(webp|png|jpe?g|avif|gif)$/i.test(e.name)) {
        out.push(`/modes/${prefix}${e.name}`);
      }
    }
  };
  walk(root, "");
  return out.sort();
}
