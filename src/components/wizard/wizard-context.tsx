"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface PlayerDraft {
  aoe2ProfileId: number | null;
  displayName: string;
  steamId?: string;
  country?: string;
  clan?: string;
  maxRatingRm1v1?: number | null;
  ratingRm1v1Current?: number | null;
  isVerified: boolean;
  isCaptain: boolean;
}

export interface WizardData {
  email: string;
  password: string;
  existingAccount: boolean;
  teamName: string;
  teamTagline: string;
  emblemId: string | null;
  players: [PlayerDraft, PlayerDraft, PlayerDraft];
  baseCivIds: string[];
  extraCivIds: string[];
  handbookDownloadedAt: Date | null;
  restreamAccepted: boolean;
  termsAcceptedAt: Date | null;
  tournamentEditionId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidEmblemId(id: string | null | undefined): boolean {
  return !!id && UUID_RE.test(id);
}

const DEFAULT_PLAYER: PlayerDraft = {
  aoe2ProfileId: null, displayName: "", isVerified: false, isCaptain: false,
};

const DEFAULT_DATA: WizardData = {
  email: "", password: "", existingAccount: false,
  teamName: "", teamTagline: "", emblemId: null,
  players: [{ ...DEFAULT_PLAYER }, { ...DEFAULT_PLAYER }, { ...DEFAULT_PLAYER }],
  baseCivIds: [], extraCivIds: [],
  handbookDownloadedAt: null, restreamAccepted: false, termsAcceptedAt: null,
  tournamentEditionId: null,
};

interface TournamentConfig {
  eloCap: number;
  eloTolerance: number;
  eloMax: number;
  civsBase: number;
  civsExtra: number;
  /** URL firmada del handbook PDF (bucket privado — la genera el server). */
  handbookUrl: string | null;
}

const DEFAULT_CONFIG: TournamentConfig = {
  eloCap: 3500,
  eloTolerance: 20,
  eloMax: 3520,
  civsBase: 9,
  civsExtra: 3,
  handbookUrl: null,
};

interface WizardContextValue {
  step: number; totalSteps: number; data: WizardData;
  config: TournamentConfig;
  setStep: (step: number) => void; nextStep: () => void; prevStep: () => void;
  updateData: (patch: Partial<WizardData>) => void;
  updatePlayer: (index: number, patch: Partial<PlayerDraft>) => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({
  children,
  initialEmail,
  initialStep,
}: {
  children: ReactNode;
  initialEmail?: string;
  initialStep?: number;
}) {
  const TOTAL = 9;
  const [step, setStepState] = useState(initialStep ?? 1);
  const [data, setData] = useState<WizardData>(
    initialEmail ? { ...DEFAULT_DATA, email: initialEmail, existingAccount: true } : DEFAULT_DATA
  );
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);

  // Fetch dinámico de la config del torneo (ELO cap, civs count)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tournament/config");
        if (res.ok) {
          const c = await res.json();
          if (!cancelled && c.found) {
            setConfig({
              eloCap: c.eloCap,
              eloTolerance: c.eloTolerance,
              eloMax: c.eloMax,
              civsBase: c.civsBase,
              civsExtra: c.civsExtra,
              handbookUrl: c.handbookUrl ?? null,
            });
          }
        }
      } catch {
        // Silently fall back to defaults
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setStep = useCallback((s: number) => setStepState(Math.max(1, Math.min(TOTAL, s))), []);
  const nextStep = useCallback(() => setStepState((s) => Math.min(TOTAL, s + 1)), []);
  const prevStep = useCallback(() => setStepState((s) => Math.max(1, s - 1)), []);
  const updateData = useCallback((patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch })), []);
  const updatePlayer = useCallback((index: number, patch: Partial<PlayerDraft>) => {
    setData((d) => {
      const players = [...d.players] as WizardData["players"];
      players[index] = { ...players[index], ...patch };
      return { ...d, players };
    });
  }, []);
  const resetWizard = useCallback(() => { setData(DEFAULT_DATA); setStepState(1); }, []);

  return (
    <WizardContext.Provider value={{ step, totalSteps: TOTAL, data, config, setStep, nextStep, prevStep, updateData, updatePlayer, resetWizard }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}

// Steps con números romanos — matchea el diseño del HTML de referencia
export const WIZARD_STEPS = [
  { num: 1, roman: "I",   label: "Cuenta" },
  { num: 2, roman: "II",  label: "Equipo" },
  { num: 3, roman: "III", label: "Jugadores" },
  { num: 4, roman: "IV",  label: "Capitán" },
  { num: 5, roman: "V",   label: "Civs base" },
  { num: 6, roman: "VI",  label: "Civs extra" },
  { num: 7, roman: "VII", label: "Handbook" },
  { num: 8, roman: "VIII",label: "Reglas" },
  { num: 9, roman: "IX",  label: "Confirmar" },
] as const;
