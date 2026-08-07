"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import Step1Account from "@/components/wizard/steps/step-1-account";
import Step2TeamData from "@/components/wizard/steps/step-2-team-data";
import Step3Players from "@/components/wizard/steps/step-3-players";
import Step4Captain from "@/components/wizard/steps/step-4-captain";
import Step5CivsBase from "@/components/wizard/steps/step-5-civs-base";
import Step6CivsExtra from "@/components/wizard/steps/step-6-civs-extra";
import Step7Handbook from "@/components/wizard/steps/step-7-handbook";
import Step8Terms from "@/components/wizard/steps/step-8-terms";
import Step9Confirm from "@/components/wizard/steps/step-9-confirm";

export default function RegistroPage() {
  const { step } = useWizard();

  switch (step) {
    case 1: return <Step1Account />;
    case 2: return <Step2TeamData />;
    case 3: return <Step3Players />;
    case 4: return <Step4Captain />;
    case 5: return <Step5CivsBase />;
    case 6: return <Step6CivsExtra />;
    case 7: return <Step7Handbook />;
    case 8: return <Step8Terms />;
    case 9: return <Step9Confirm />;
    default: return <Step1Account />;
  }
}
