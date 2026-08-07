"use client";
import { useWizard } from "@/components/wizard/wizard-context";

const EMBLEMS = [
  "Caballero", "Águila", "Dragón", "León", "Lobo", "Cuervo",
  "Oso", "Halcón", "Serpiente", "Toro", "Unicornio", "Fénix",
].map((name, i) => ({ id: `e${i + 1}`, name }));

export default function Step2TeamData() {
  const { data, updateData } = useWizard();
  return (
    <>
      <div className="field">
        <label htmlFor="teamName">Nombre del equipo</label>
        <input id="teamName" type="text" placeholder="Ej: Reinos Unidos" value={data.teamName}
          onChange={(e) => updateData({ teamName: e.target.value })} maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="teamTagline">Frase del equipo <small>(opcional)</small></label>
        <input id="teamTagline" type="text" placeholder="Ej: Honor et gloria" value={data.teamTagline}
          onChange={(e) => updateData({ teamTagline: e.target.value })} maxLength={140} />
      </div>
      <div className="chips-head">
        <span className="counter" style={{ background: data.emblemId ? "rgba(124,58,237,.12)" : undefined, borderColor: data.emblemId ? "var(--purple)" : undefined }}>
          {data.emblemId ? "1 / 1" : "0 / 1"}
        </span>
      </div>
      <div className="chips" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))" }}>
        {EMBLEMS.map((emblem) => {
          const sel = data.emblemId === emblem.id;
          return (
            <button key={emblem.id} className={`chip ${sel ? "sel" : ""}`} onClick={() => updateData({ emblemId: emblem.id })}>
              {emblem.name}
            </button>
          );
        })}
      </div>
    </>
  );
}
