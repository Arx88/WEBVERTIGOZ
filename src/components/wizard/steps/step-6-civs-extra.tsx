"use client";
import { useWizard } from "@/components/wizard/wizard-context";

const CIVS = ["Britanos","Francos","Godos","Teutones","Japoneses","Chinos","Bizantinos","Persas","Sarracenos","Turcos","Vikingos","Mongoles","Celtas","Españoles","Aztecas","Mayas","Hunos","Coreanos","Italianos","Hindúes","Incas","Magiares","Eslavos","Bereberes","Etíopes","Malianos","Portugueses","Birmanos","Jémeres","Malayos","Vietnamitas","Búlgaros","Cumanos","Lituanos","Tártaros","Borgoñones","Sicilianos","Polacos","Bohemios","Romanos"];

export default function Step6CivsExtra() {
  const { data, updateData } = useWizard();
  const sel = data.extraCivIds;
  const base = data.baseCivIds;
  const MAX = 3;
  const toggle = (c: string) => {
    if (base.includes(c)) return;
    if (sel.includes(c)) updateData({ extraCivIds: sel.filter((x) => x !== c) });
    else if (sel.length < MAX) updateData({ extraCivIds: [...sel, c] });
  };
  return (
    <>
      <div className="chips-head">
        <span className={`counter ${sel.length === MAX ? "full" : ""}`}>{sel.length} / {MAX} · Pool total: {9 + sel.length}/12</span>
      </div>
      <div className="chips">
        {CIVS.map((c) => {
          const isBase = base.includes(c);
          return (
            <button key={c} className={`chip ${sel.includes(c) ? "sel" : ""}`}
              onClick={() => toggle(c)} disabled={isBase || (!sel.includes(c) && sel.length >= MAX)}
              style={{ opacity: isBase ? 0.25 : (!sel.includes(c) && sel.length >= MAX ? 0.3 : 1) }}>
              {c}{isBase ? " ✓" : ""}
            </button>
          );
        })}
      </div>
    </>
  );
}
