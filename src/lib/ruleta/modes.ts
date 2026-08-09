export interface Mode {
  title: string;
  tag: string;
  color: string;
  img: string;
  kind: "MODO" | "ANTIMETA" | "FORMATO";
  tagline: string;
  description: string;
  rules: string[];
}

export function hexToRgba(h: string, a: number): string {
  const v = parseInt(h.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}
