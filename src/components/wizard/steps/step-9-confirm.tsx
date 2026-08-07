"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Shield, Crown, Star, FileText, Check, Swords, Flag, Radio, ShieldAlert, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Step 9 — Confirmación
// Layout: 3 columnas (top) + full-width players + civs + state
// ============================================================

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
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-[3px]",
        variant === "base"
          ? "border-[rgba(255,46,158,0.4)] bg-[rgba(255,46,158,0.04)]"
          : "border-[rgba(255,46,158,0.2)] bg-transparent"
      )}
    >
      <span className="font-cinzel text-[10px] tabular-nums text-[rgba(255,180,220,0.55)]">
        {String(idx + 1).padStart(2, "0")}.
      </span>
      <span
        className={cn(
          "font-cinzel text-[11px] tracking-[0.12em] uppercase",
          variant === "base" ? "text-[#ff2e9e]" : "text-[rgba(255,180,220,0.85)]"
        )}
      >
        {civ?.name ?? civId}
      </span>
    </span>
  );
}

export default function WizardStepConfirm() {
  const { data } = useWizard();

  const totalElo = data.players.reduce((sum, p) => sum + (p.maxRatingRm1v1 ?? 0), 0);
  const captain = data.players.find((p) => p.isCaptain);

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
      <p className="wiz-body max-w-2xl mx-auto text-center">
        Revisá todos los datos antes de confirmar. Una vez enviada, el staff la
        revisará y aprobará. Las civilizaciones y la cuenta de equipo son
        definitivas para esta edición.
      </p>

      {/* ====== Top row: 3 cards ====== */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Card: Equipo */}
        <section className="wiz-card !rounded-[4px] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-3.5 h-3.5 text-[#ff2e9e]" strokeWidth={1.5} />
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
              Equipo
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-[rgba(255,46,158,0.55)] flex items-center justify-center text-[#ff2e9e] shadow-[0_0_12px_rgba(255,46,158,0.3)] shrink-0">
              <Shield className="w-6 h-6" strokeWidth={1.25} />
            </div>
            <div className="min-w-0">
              <div className="font-cinzel text-[16px] text-[#f5eaff] truncate">
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

        {/* Card: ELO total */}
        <section className="wiz-card !rounded-[4px] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Swords className="w-3.5 h-3.5 text-[#ff2e9e]" strokeWidth={1.5} />
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
              ELO total
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-cinzel text-[34px] tabular-nums leading-none text-[#ff2e9e]"
              style={{ textShadow: "0 0 18px rgba(255,46,158,0.5)" }}
            >
              {totalElo}
            </span>
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.18em" }}>
              de 3520 máx
            </span>
          </div>
          <div className="mt-3 h-1 w-full bg-[rgba(255,46,158,0.08)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[rgba(255,46,158,0.55)] to-[#ff2e9e] shadow-[0_0_8px_rgba(255,46,158,0.55)] rounded-full"
              style={{ width: `${Math.min(100, (totalElo / 3520) * 100)}%` }}
            />
          </div>
        </section>

        {/* Card: Capitán */}
        <section className="wiz-card !rounded-[4px] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-3.5 h-3.5 text-[#ff2e9e]" strokeWidth={1.5} />
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
              Capitán
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-[#ff2e9e] text-[#ff2e9e] flex items-center justify-center shadow-[0_0_14px_rgba(255,46,158,0.4)] shrink-0">
              <Crown className="w-6 h-6" strokeWidth={1.25} />
            </div>
            <div className="min-w-0">
              <div className="font-cinzel text-[14px] text-[#f5eaff] truncate">
                {captain?.displayName || "—"}
              </div>
              <div className="wiz-meta text-[10px] normal-case mt-0.5">
                {captain?.country && <span>{captain.country}</span>}
                {captain?.clan && <span> · {captain.clan}</span>}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ====== Players row (3 cols) ====== */}
      <section className="wiz-card !rounded-[4px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-3.5 h-3.5 text-[#ff2e9e]" strokeWidth={1.5} />
          <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
            Jugadores
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {data.players.map((player, idx) => (
            <div key={idx} className="text-center">
              <div
                className={cn(
                  "w-12 h-12 rounded-full border flex items-center justify-center mx-auto mb-2 transition-all",
                  player.isCaptain
                    ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_14px_rgba(255,46,158,0.45)]"
                    : "border-[rgba(255,46,158,0.35)] text-[rgba(255,180,220,0.55)]"
                )}
              >
                {player.isCaptain ? (
                  <Crown className="w-6 h-6" strokeWidth={1.25} />
                ) : (
                  <span className="font-cinzel text-[14px]">{idx + 1}</span>
                )}
              </div>
              <div className="font-cinzel text-[12px] text-[#f5eaff] truncate">
                {player.displayName}
              </div>
              <div className="wiz-meta text-[9px] normal-case mt-0.5">
                {player.country && (
                  <span className="inline-flex items-center gap-0.5">
                    <Flag className="w-2.5 h-2.5" strokeWidth={1.5} />
                    {player.country}
                  </span>
                )}
                {player.clan && <span> · {player.clan}</span>}
              </div>
              {player.maxRatingRm1v1 !== undefined && (
                <div className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="font-cinzel text-[13px] tabular-nums text-[#ff2e9e]">
                    {player.maxRatingRm1v1}
                  </span>
                  <span className="font-inter text-[8px] tracking-[0.18em] uppercase text-[rgba(255,180,220,0.45)]">
                    ELO
                  </span>
                </div>
              )}
              {player.isCaptain && (
                <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 border-y border-[rgba(255,46,158,0.5)] bg-[rgba(255,46,158,0.06)] rounded-[2px]">
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

      {/* ====== Civs row ====== */}
      <section className="wiz-card !rounded-[4px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Swords className="w-3.5 h-3.5 text-[#ff2e9e]" strokeWidth={1.5} />
          <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
            Civilizaciones · pool total {9 + data.extraCivIds.length}
          </span>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <div className="wiz-caption text-[9px] mb-2" style={{ letterSpacing: "0.18em" }}>
              9 civs base
            </div>
            <div className="flex flex-wrap gap-1.5">
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
            <div className="wiz-caption text-[9px] mb-2" style={{ letterSpacing: "0.18em" }}>
              3 civs extra (final)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.extraCivIds.length === 0 ? (
                <span className="text-[12px] text-[rgba(255,180,220,0.4)] italic">—</span>
              ) : (
                data.extraCivIds.map((civId, idx) => (
                  <CivChip key={civId} civId={civId} idx={idx} variant="extra" />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ====== Confirmations + warning row ====== */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className="wiz-card !rounded-[4px] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-3.5 h-3.5 text-[#ff2e9e]" strokeWidth={1.5} />
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
              Confirmaciones
            </span>
          </div>
          <ul className="space-y-2">
            <li className="flex items-center gap-3">
              <Mail className="w-3.5 h-3.5 text-[#ff2e9e] shrink-0" strokeWidth={1.5} />
              <span className="wiz-body text-[12px]">
                <span className="text-[rgba(255,180,220,0.55)]">Cuenta:</span>{" "}
                <span className="text-[#f5eaff] font-cinzel">{data.email}</span>
              </span>
            </li>
            <li className="flex items-center gap-3">
              {data.handbookDownloadedAt ? (
                <Check className="w-3.5 h-3.5 text-[#ff2e9e] shrink-0" strokeWidth={2} />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[rgba(255,180,220,0.45)] shrink-0" strokeWidth={1.5} />
              )}
              <span className="wiz-body text-[12px]">Handbook descargado</span>
            </li>
            <li className="flex items-center gap-3">
              {data.restreamAccepted ? (
                <Check className="w-3.5 h-3.5 text-[#ff2e9e] shrink-0" strokeWidth={2} />
              ) : (
                <Radio className="w-3.5 h-3.5 text-[rgba(255,180,220,0.45)] shrink-0" strokeWidth={1.5} />
              )}
              <span className="wiz-body text-[12px]">Permiso de transmisión aceptado</span>
            </li>
            <li className="flex items-center gap-3">
              {data.termsAcceptedAt ? (
                <Check className="w-3.5 h-3.5 text-[#ff2e9e] shrink-0" strokeWidth={2} />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-[rgba(255,180,220,0.45)] shrink-0" strokeWidth={1.5} />
              )}
              <span className="wiz-body text-[12px]">Reglamento aceptado</span>
            </li>
          </ul>
        </section>

        <section className="wiz-panel-active border-l-2 !border-l-[#ff2e9e] p-5 rounded-[4px] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-[#ff2e9e]" strokeWidth={1.5} />
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
              Próximo paso
            </span>
          </div>
          <p className="wiz-body text-[13px]">
            Al confirmar, tu equipo quedará{" "}
            <span className="text-[#ff2e9e] font-semibold">pendiente de aprobación</span>.
            El staff revisará los perfiles AoE2 Companion de los 3 jugadores y la
            suma de ELO. Recibirás la confirmación por email antes del inicio del
            torneo.
          </p>
        </section>
      </div>
    </div>
  );
}
