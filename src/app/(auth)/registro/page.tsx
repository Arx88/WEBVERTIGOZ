"use client";

import dynamic from "next/dynamic";

const WizardRouter = dynamic(() => import("./wizard-router"), { ssr: false });

export default function RegistroPage() {
  return <WizardRouter />;
}
