"use client";

import dynamic from "next/dynamic";
import { ConfigProvider } from "@/lib/ruleta/config";

// La ruleta necesita window (canvas, audio, RAF) → no SSR
const Roulette = dynamic(
  () => import("@/components/ruleta/roulette").then((m) => m.Roulette),
  { ssr: false }
);

export default function RuletaDemoPage() {
  return (
    <ConfigProvider>
      <Roulette />
    </ConfigProvider>
  );
}
