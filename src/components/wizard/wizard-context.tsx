"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ============================================================
// Tipos del wizard
// ============================================================

export interface WizardPlayerDraft {
  aoe2ProfileId: number | null;
  displayName: string;
  steamId?: string;
  country?: string;
  clan?: string;
  maxRatingRm1v1?: number | null;
  ratingRm1v1Current?: number | null;
  ratingRm1v1Rank?: number | null;
  isVerified: boolean;
  isCaptain: boolean;
  verificationStatus: "verified" | "pending" | "hidden" | "failed";
}

export interface WizardData {
  // Paso 1: Cuenta
  email: string;
  password: string;
  existingAccount: boolean;

  // Paso 2: Datos equipo
  teamName: string;
  teamTagline: string;
  emblemId: string | null;

  // Paso 3: Jugadores
  players: [WizardPlayerDraft, WizardPlayerDraft, WizardPlayerDraft];

  // Paso 5-6: Civs
  baseCivIds: string[];
  extraCivIds: string[];

  // Paso 7: Handbook
  handbookDownloadedAt: Date | null;

  // Paso 8: Términos
  restreamAccepted: boolean;
  termsAcceptedAt: Date | null;

  // Tournament edition (viene de query param o context)
  tournamentEditionId: string | null;
}

const DEFAULT_DATA: WizardData = {
  email: "",
  password: "",
  existingAccount: false,
  teamName: "",
  teamTagline: "",
  emblemId: null,
  players: [
    { aoe2ProfileId: null, displayName: "", isVerified: false, isCaptain: false, verificationStatus: "pending" },
    { aoe2ProfileId: null, displayName: "", isVerified: false, isCaptain: false, verificationStatus: "pending" },
    { aoe2ProfileId: null, displayName: "", isVerified: false, isCaptain: false, verificationStatus: "pending" },
  ],
  baseCivIds: [],
  extraCivIds: [],
  handbookDownloadedAt: null,
  restreamAccepted: false,
  termsAcceptedAt: null,
  tournamentEditionId: null,
};

// ============================================================
// Context
// ============================================================

interface WizardContextValue {
  step: number;
  totalSteps: number;
  data: WizardData;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  updateData: (patch: Partial<WizardData>) => void;
  updatePlayer: (index: number, patch: Partial<WizardPlayerDraft>) => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const TOTAL_STEPS = 9;
  const [step, setStepState] = useState(1);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);

  const setStep = useCallback((s: number) => {
    setStepState(Math.max(1, Math.min(TOTAL_STEPS, s)));
  }, []);

  const nextStep = useCallback(() => {
    setStepState((s) => Math.min(TOTAL_STEPS, s + 1));
  }, []);

  const prevStep = useCallback(() => {
    setStepState((s) => Math.max(1, s - 1));
  }, []);

  const goToStep = useCallback((s: number) => {
    setStepState(Math.max(1, Math.min(TOTAL_STEPS, s)));
  }, []);

  const updateData = useCallback((patch: Partial<WizardData>) => {
    setData((d) => ({ ...d, ...patch }));
  }, []);

  const updatePlayer = useCallback((index: number, patch: Partial<WizardPlayerDraft>) => {
    setData((d) => {
      const players = [...d.players] as WizardData["players"];
      players[index] = { ...players[index], ...patch };
      return { ...d, players };
    });
  }, []);

  const resetWizard = useCallback(() => {
    setData(DEFAULT_DATA);
    setStepState(1);
  }, []);

  return (
    <WizardContext.Provider
      value={{
        step,
        totalSteps: TOTAL_STEPS,
        data,
        setStep,
        nextStep,
        prevStep,
        goToStep,
        updateData,
        updatePlayer,
        resetWizard,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard debe usarse dentro de WizardProvider");
  return ctx;
}

// ============================================================
// Constantes de pasos
// ============================================================

export const WIZARD_STEPS = [
  { num: 1, key: "account", title: "Tu cuenta", short: "Cuenta" },
  { num: 2, key: "team-data", title: "Datos del equipo", short: "Equipo" },
  { num: 3, key: "players", title: "Cargar jugadores", short: "Jugadores" },
  { num: 4, key: "captain", title: "Elegir capitán", short: "Capitán" },
  { num: 5, key: "civs-base", title: "Civilizaciones base", short: "9 civs" },
  { num: 6, key: "civs-extra", title: "Civilizaciones extra", short: "3 civs extra" },
  { num: 7, key: "handbook", title: "Handbook", short: "Handbook" },
  { num: 8, key: "terms", title: "Términos", short: "Términos" },
  { num: 9, key: "confirm", title: "Confirmación", short: "Confirmar" },
] as const;
