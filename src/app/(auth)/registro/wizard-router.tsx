"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import dynamic from "next/dynamic";

const Step1 = dynamic(() => import("@/components/wizard/steps/step-1-account"));
const Step2 = dynamic(() => import("@/components/wizard/steps/step-2-team-data"));
const Step3 = dynamic(() => import("@/components/wizard/steps/step-3-players"));
const Step4 = dynamic(() => import("@/components/wizard/steps/step-4-captain"));
const Step5 = dynamic(() => import("@/components/wizard/steps/step-5-civs-base"));
const Step6 = dynamic(() => import("@/components/wizard/steps/step-6-civs-extra"));
const Step7 = dynamic(() => import("@/components/wizard/steps/step-7-handbook"));
const Step8 = dynamic(() => import("@/components/wizard/steps/step-8-terms"));
const Step9 = dynamic(() => import("@/components/wizard/steps/step-9-confirm"));

export default function WizardRouter() {
  const { step } = useWizard();
  switch (step) {
    case 1: return <Step1 />;
    case 2: return <Step2 />;
    case 3: return <Step3 />;
    case 4: return <Step4 />;
    case 5: return <Step5 />;
    case 6: return <Step6 />;
    case 7: return <Step7 />;
    case 8: return <Step8 />;
    case 9: return <Step9 />;
    default: return <Step1 />;
  }
}
