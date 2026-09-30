"use client";

import { HUD } from "@/components/HUD";
import { WebSocketProvider } from "@/components/WebSocketProvider";

export default function Home() {
  return (
    <WebSocketProvider>
      <main aria-label="QUANTORA ORBIT">
        <HUD />
      </main>
    </WebSocketProvider>
  );
}
