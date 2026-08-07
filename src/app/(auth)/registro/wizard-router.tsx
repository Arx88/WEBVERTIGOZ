"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import Step1 from "@/components/wizard/steps/step-1-account";
import Step2 from "@/components/wizard/steps/step-2-team-data";
import Step3 from "@/components/wizard/steps/step-3-players";
import Step4 from "@/components/wizard/steps/step-4-captain";
import Step5 from "@/components/wizard/steps/step-5-civs-base";
import Step6 from "@/components/wizard/steps/step-6-civs-extra";
import Step7 from "@/components/wizard/steps/step-7-handbook";
import Step8 from "@/components/wizard/steps/step-8-terms";
import Step9 from "@/components/wizard/steps/step-9-confirm";

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
