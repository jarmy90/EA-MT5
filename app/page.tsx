"use client";

import dynamic from "next/dynamic";
import { HUD } from "@/components/HUD";
import { WebSocketProvider } from "@/components/WebSocketProvider";

const Scene = dynamic(
  () => import("@/components/Scene").then((module) => module.Scene),
  { ssr: false, loading: () => <div className="loading">FORMANDO MATERIA...</div> },
);

export default function Home() {
  return (
    <WebSocketProvider>
      <main aria-label="QUANTORA ORBIT">
        <Scene />
        <HUD />
      </main>
    </WebSocketProvider>
  );
}
