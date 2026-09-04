import type { Telemetry } from "../lib/schema";

const names = ["Stoch Adaptive", "Modular Conductor", "Sentiment Mirror", "Quantora Sniper"];

export function mockTelemetry(t: number): Telemetry {
  const phase = t / 8;
  const pnls = names.map(
    (_, index) => Math.sin(phase + index * 1.7) * 38 + Math.cos(phase * 0.37 + index) * 12,
  );
  const floating = pnls.reduce((total, value) => total + value, 0);
  const now = new Date().toISOString();

  return {
    type: "telemetry",
    balance: 1350 + 172 + floating,
    initialBalance: 1350,
    currency: "EUR",
    timestamp: now,
    source: "mock",
    bridgeConnected: true,
    bots: names.map((name, index) => ({
      id: `bot-${index + 1}`,
      name,
      pnl: Number(pnls[index].toFixed(2)),
      exposurePct: [18, 27, 13, 22][index],
      side: Math.abs(pnls[index]) < 4 ? "flat" : index % 2 ? "short" : "long",
      updatedAt: now,
    })),
  };
}
