"use client";
import { useWizard } from "@/components/wizard/wizard-context";

const CIVS = ["Britanos","Francos","Godos","Teutones","Japoneses","Chinos","Bizantinos","Persas","Sarracenos","Turcos","Vikingos","Mongoles","Celtas","Españoles","Aztecas","Mayas","Hunos","Coreanos","Italianos","Hindúes","Incas","Magiares","Eslavos","Bereberes","Etíopes","Malianos","Portugueses","Birmanos","Jémeres","Malayos","Vietnamitas","Búlgaros","Cumanos","Lituanos","Tártaros","Borgoñones","Sicilianos","Polacos","Bohemios","Romanos"];

export default function Step5CivsBase() {
  const { data, updateData } = useWizard();
  const sel = data.baseCivIds;
  const MAX = 9;
  const toggle = (c: string) => {
    if (sel.includes(c)) updateData({ baseCivIds: sel.filter((x) => x !== c) });
    else if (sel.length < MAX) updateData({ baseCivIds: [...sel, c] });
  };
  return (
    <>
      <div className="chips-head">
        <span className={`counter ${sel.length === MAX ? "full" : ""}`}>{sel.length} / {MAX}</span>
      </div>
      <div className="chips">
        {CIVS.map((c) => (
          <button key={c} className={`chip ${sel.includes(c) ? "sel" : ""}`} onClick={() => toggle(c)} disabled={!sel.includes(c) && sel.length >= MAX}
            style={{ opacity: !sel.includes(c) && sel.length >= MAX ? 0.3 : 1 }}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}
