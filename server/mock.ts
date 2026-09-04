import type { Telemetry } from "../lib/schema";

const names = ["Demo Alpha", "Demo Sigma", "Demo Prime", "Demo Flash"];

export function mockTelemetry(t: number): Telemetry {
  const phase = t / 8;
  const pnls = names.map((_, index) => Math.sin(phase + index * 1.7) * 38 + Math.cos(phase * 0.37 + index) * 12);
  const floatingPnl = pnls.reduce((total, value) => total + value, 0);
  const balance = 1350 + floatingPnl;
  const now = new Date().toISOString();

  return {
    type: "telemetry",
    balance,
    equity: balance,
    floatingPnl,
    startingBalance: 1350,
    totalReturn: floatingPnl,
    totalReturnPct: floatingPnl / 1350 * 100,
    currency: "EUR",
    timestamp: now,
    source: "mock",
    bridgeConnected: false,
    connectionState: "disconnected",
    bots: names.map((name, index) => {
      const pnl = Number(pnls[index].toFixed(2));
      const active = Math.abs(pnl) > 4;
      return {
        id: `bot-${index + 1}`,
        name,
        active,
        state: active ? (index % 2 ? "short" : "long") : "flat" as const,
        symbol: active ? (index < 2 ? "USTEC" : "XAUUSD") : null,
        pnl,
        profit: pnl,
        swap: 0,
        commission: 0,
        volume: active ? [0.1, 0.2, 0.1, 0.15][index] : 0,
        openPositions: active ? 1 : 0,
        exposurePct: active ? [18, 27, 13, 22][index] : 0,
        balanceUsagePct: active ? [18, 27, 13, 22][index] : 0,
        pnlVelocity: 0,
        marketVelocity: 0,
        priceAverage: null,
        priceCurrent: null,
        updatedAt: now,
      };
    }),
  };
}
