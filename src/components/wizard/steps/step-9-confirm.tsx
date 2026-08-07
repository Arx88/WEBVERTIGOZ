"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Shield, Crown, Star, FileText, Check, Swords } from "lucide-react";

// Re-importamos la lista de civs para mapear IDs a nombres en el review final
const AOE2_CIVS: { id: string; name: string }[] = [
  { id: "britons", name: "Britanos" },
  { id: "franks", name: "Francos" },
  { id: "goths", name: "Godos" },
  { id: "teutons", name: "Teutones" },
  { id: "japanese", name: "Japoneses" },
  { id: "chinese", name: "Chinos" },
  { id: "byzantines", name: "Bizantinos" },
  { id: "persians", name: "Persas" },
  { id: "saracens", name: "Sarracenos" },
  { id: "turks", name: "Turcos" },
  { id: "vikings", name: "Vikingos" },
  { id: "mongols", name: "Mongoles" },
  { id: "celts", name: "Celtas" },
  { id: "spanish", name: "Españoles" },
  { id: "aztecs", name: "Aztecas" },
  { id: "mayans", name: "Mayas" },
  { id: "huns", name: "Hunos" },
  { id: "koreans", name: "Coreanos" },
  { id: "italians", name: "Italianos" },
  { id: "indians", name: "Hindúes" },
  { id: "incas", name: "Incas" },
  { id: "magyars", name: "Magiares" },
  { id: "slavs", name: "Eslavos" },
  { id: "berbers", name: "Bereberes" },
  { id: "ethiopians", name: "Etíopes" },
  { id: "malians", name: "Malianos" },
  { id: "portuguese", name: "Portugueses" },
  { id: "burmese", name: "Birmanos" },
  { id: "khmer", name: "Jémeres" },
  { id: "malay", name: "Malayos" },
  { id: "vietnamese", name: "Vietnamitas" },
  { id: "bulgarians", name: "Búlgaros" },
  { id: "cumans", name: "Cumanos" },
  { id: "lithuanians", name: "Lituanos" },
  { id: "tatars", name: "Tártaros" },
  { id: "burgundians", name: "Borgoñones" },
  { id: "sicilians", name: "Sicilianos" },
  { id: "poles", name: "Polacos" },
  { id: "bohemians", name: "Bohemios" },
  { id: "romans", name: "Romanos" },
];

function CivChip({ civId, idx, variant }: { civId: string; idx: number; variant: "base" | "extra" }) {
  const civ = AOE2_CIVS.find((c) => c.id === civId);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border ${
        variant === "base"
          ? "border-[rgba(255,46,158,0.4)] bg-[rgba(255,46,158,0.04)]"
          : "border-[rgba(255,46,158,0.2)] bg-transparent"
      }`}
    >
      <span className="font-cinzel text-[10px] tabular-nums text-[rgba(255,180,220,0.55)]">
        {String(idx + 1).padStart(2, "0")}.
      </span>
      <span
        className={`font-cinzel text-[11px] tracking-[0.12em] uppercase ${
          variant === "base" ? "text-[#ff2e9e]" : "text-[rgba(255,180,220,0.85)]"
        }`}
      >
        {civ?.name ?? civId}
      </span>
    </span>
  );
}

export default function WizardStepConfirm() {
  const { data } = useWizard();

  const totalElo = data.players.reduce((sum, p) => sum + (p.maxRatingRm1v1 ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-4 text-center">
      <p className="wiz-body max-w-xl mx-auto">
        Revisá todos los datos antes de confirmar. Una vez enviada, el staff la
        revisará y aprobará. Las civilizaciones y la cuenta de equipo son
        definitivas para esta edición.
      </p>

      <div className="grid md:grid-cols-2 gap-4 text-left">
        {/* Equipo */}
        <section className="wiz-panel p-5">
          <div className="wiz-caption mb-3" style={{ letterSpacing: "0.32em" }}>
            Equipo
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-[rgba(255,46,158,0.55)] flex items-center justify-center text-[#ff2e9e] shadow-[0_0_12px_rgba(255,46,158,0.3)] shrink-0">
              <Shield className="w-6 h-6" strokeWidth={1.25} />
            </div>
            <div className="min-w-0">
              <div className="font-cinzel text-lg text-[#f5eaff] truncate">
                {data.teamName || "—"}
              </div>
              {data.teamTagline && (
                <div className="text-[12px] italic mt-0.5 text-[#e6d3f5] truncate">
                  &ldquo;{data.teamTagline}&rdquo;
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ELO */}
        <section className="wiz-panel p-5">
          <div className="wiz-caption mb-3" style={{ letterSpacing: "0.32em" }}>
            ELO total
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-cinzel text-3xl tabular-nums text-[#ff2e9e] shadow-[0_0_18px_rgba(255,46,158,0.4)]">
              {totalElo}
            </span>
            <span className="wiz-caption" style={{ letterSpacing: "0.18em" }}>
              de 3520 máx
            </span>
          </div>
        </section>
      </div>

      {/* Jugadores */}
      <section className="wiz-panel p-5 text-left">
        <div className="wiz-caption mb-3" style={{ letterSpacing: "0.32em" }}>
          Jugadores
        </div>
        <div className="grid grid-cols-3 gap-4">
          {data.players.map((player, idx) => (
            <div key={idx} className="text-center">
              <div
                className={`w-10 h-10 rounded-full border flex items-center justify-center mx-auto mb-2 ${
                  player.isCaptain
                    ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_12px_rgba(255,46,158,0.4)]"
                    : "border-[rgba(255,46,158,0.35)] text-[rgba(255,180,220,0.55)]"
                }`}
              >
                {player.isCaptain ? (
                  <Crown className="w-5 h-5" strokeWidth={1.25} />
                ) : (
                  <span className="font-cinzel text-sm">{idx + 1}</span>
                )}
              </div>
              <div className="font-cinzel text-[12px] text-[#f5eaff] truncate">
                {player.displayName}
              </div>
              <div className="wiz-caption mt-1 text-[9px] normal-case" style={{ letterSpacing: "0.06em" }}>
                {player.country} · {player.clan ?? "—"}
              </div>
              {player.maxRatingRm1v1 !== undefined && (
                <div className="text-[11px] text-[#e6d3f5] mt-1">
                  ELO máx:{" "}
                  <span className="font-cinzel font-semibold text-[#ff2e9e] tabular-nums">
                    {player.maxRatingRm1v1}
                  </span>
                </div>
              )}
              {player.isCaptain && (
                <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 border-y border-[rgba(255,46,158,0.5)] bg-[rgba(255,46,158,0.06)]">
                  <Crown className="w-2.5 h-2.5 text-[#ff2e9e]" strokeWidth={1.5} />
                  <span className="font-cinzel text-[8px] tracking-[0.18em] uppercase text-[#ff2e9e]">
                    Capitán
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Civs */}
      <section className="wiz-panel p-5 text-left">
        <div className="wiz-caption mb-3" style={{ letterSpacing: "0.32em" }}>
          Civilizaciones
        </div>
        <div className="mb-4">
          <div className="wiz-caption mb-2 text-[10px]" style={{ letterSpacing: "0.18em" }}>
            9 civs base
          </div>
          <div className="flex flex-wrap gap-2">
            {data.baseCivIds.length === 0 ? (
              <span className="text-[12px] text-[rgba(255,180,220,0.4)] italic">—</span>
            ) : (
              data.baseCivIds.map((civId, idx) => (
                <CivChip key={civId} civId={civId} idx={idx} variant="base" />
              ))
            )}
          </div>
        </div>
        <div>
          <div className="wiz-caption mb-2 text-[10px]" style={{ letterSpacing: "0.18em" }}>
            3 civs extra (final)
          </div>
          <div className="flex flex-wrap gap-2">
            {data.extraCivIds.length === 0 ? (
              <span className="text-[12px] text-[rgba(255,180,220,0.4)] italic">—</span>
            ) : (
              data.extraCivIds.map((civId, idx) => (
                <CivChip key={civId} civId={civId} idx={idx} variant="extra" />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Confirmaciones */}
      <section className="wiz-panel p-5 text-left">
        <div className="wiz-caption mb-3" style={{ letterSpacing: "0.32em" }}>
          Confirmaciones
        </div>
        <ul className="space-y-2.5">
          <li className="flex items-center gap-3">
            <Check className="w-4 h-4 text-[#ff2e9e]" strokeWidth={2} />
            <span className="text-[13px] text-[#e6d3f5]">
              Cuenta de equipo:{" "}
              <span className="text-[#f5eaff] font-cinzel">{data.email}</span>
            </span>
          </li>
          <li className="flex items-center gap-3">
            {data.handbookDownloadedAt ? (
              <Check className="w-4 h-4 text-[#ff2e9e]" strokeWidth={2} />
            ) : (
              <FileText className="w-4 h-4 text-[rgba(255,180,220,0.45)]" strokeWidth={1.5} />
            )}
            <span className="text-[13px] text-[#e6d3f5]">Handbook descargado</span>
          </li>
          <li className="flex items-center gap-3">
            {data.restreamAccepted ? (
              <Check className="w-4 h-4 text-[#ff2e9e]" strokeWidth={2} />
            ) : (
              <Star className="w-4 h-4 text-[rgba(255,180,220,0.45)]" strokeWidth={1.5} />
            )}
            <span className="text-[13px] text-[#e6d3f5]">Permiso de transmisión aceptado</span>
          </li>
          <li className="flex items-center gap-3">
            {data.termsAcceptedAt ? (
              <Check className="w-4 h-4 text-[#ff2e9e]" strokeWidth={2} />
            ) : (
              <Swords className="w-4 h-4 text-[rgba(255,180,220,0.45)]" strokeWidth={1.5} />
            )}
            <span className="text-[13px] text-[#e6d3f5]">Reglamento aceptado</span>
          </li>
        </ul>
      </section>

      {/* Advertencia final */}
      <div className="wiz-panel border-l-2 border-l-[#ff2e9e] px-4 py-3 text-left max-w-2xl mx-auto">
        <p className="text-[13px] leading-relaxed text-[#e6d3f5]">
          Al confirmar, tu equipo quedará{" "}
          <span className="text-[#ff2e9e] font-semibold">pendiente de aprobación</span>.
          El staff revisará los perfiles AoE2 Companion de los 3 jugadores y la
          suma de ELO. Recibirás la confirmación por email antes del inicio del
          torneo.
        </p>
      </div>
    </div>
  );
}
