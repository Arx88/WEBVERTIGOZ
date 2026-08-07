"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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

interface WizardContextValue {
  step: number; totalSteps: number; data: WizardData;
  setStep: (step: number) => void; nextStep: () => void; prevStep: () => void;
  updateData: (patch: Partial<WizardData>) => void;
  updatePlayer: (index: number, patch: Partial<PlayerDraft>) => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const TOTAL = 9;
  const [step, setStepState] = useState(1);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);

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
    <WizardContext.Provider value={{ step, totalSteps: TOTAL, data, setStep, nextStep, prevStep, updateData, updatePlayer, resetWizard }}>
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
