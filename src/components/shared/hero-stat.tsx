/**
 * VÉRTIGO Cup — HeroStat
 *
 * Métrica en vidrio (número Cinzel grande + rótulo) para integrar stats
 * DENTRO de un hero cinematográfico en vez de tirarlas en una fila aparte.
 * `value` acepta number o string (nombres de edición, "12 / 32", "≥ 50"):
 * los textos largos bajan a tamaño compacto para no romper la tira.
 * Server-safe: sin estado, sin eventos.
 */
export default function HeroStat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  const text = String(value);
  const compact = text.length > 6;

  return (
    <div
      style={{
        textAlign: "center",
        padding: "10px 20px 9px",
        borderRadius: 12,
        background: "rgba(10,6,17,0.55)",
        border: "1px solid var(--vertigo-line-soft)",
        backdropFilter: "blur(8px)",
        minWidth: 96,
      }}
    >
      <div
        className="font-cinzel font-bold leading-none tabular-nums"
        style={{
          fontSize: compact ? 17 : 26,
          color,
          textShadow: "0 2px 18px rgba(0,0,0,0.65)",
          maxWidth: 260,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </div>
      <div
        className="uppercase"
        style={{ fontSize: 9, letterSpacing: 2, color: "var(--vertigo-muted)", marginTop: 5 }}
      >
        {label}
      </div>
    </div>
  );
}
