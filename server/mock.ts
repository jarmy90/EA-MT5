import type { Telemetry } from "../lib/schema";

const names = [
  "StochExtreme USTEC",
  "Descargar USTEC M30",
  "StochExtreme Oro",
  "Descargar Oro M15",
  "VDPM DAX H1",
  "US500 Pro",
];

export function mockTelemetry(t: number): Telemetry {
  const phase = t / 8;
  const pnls = names.map((_, index) => Math.sin(phase + index * 1.7) * 38 + Math.cos(phase * 0.37 + index) * 12);
  const closed = [64.2, -18.5, 41.8, 12.4, -6.1, 28.7];
  const floatingPnl = pnls.reduce((total, value) => total + value, 0);
  const balance = 1350 + closed.reduce((total, value) => total + value, 0) + floatingPnl;
  const equity = balance;
  const margin = 412.5;
  const now = new Date().toISOString();

  return {
    type: "telemetry",
    balance,
    equity,
    floatingPnl,
    margin,
    marginFree: equity - margin,
    marginLevel: margin > 0 ? equity / margin * 100 : 0,
    leverage: 100,
    openPositions: 4,
    startingBalance: 1350,
    totalReturn: balance - 1350,
    totalReturnPct: (balance - 1350) / 1350 * 100,
    currency: "EUR",
    timestamp: now,
    source: "mock",
    bridgeConnected: false,
    connectionState: "disconnected",
    bots: names.map((name, index) => {
      const pnl = Number(pnls[index].toFixed(2));
      const closedPnl = closed[index] ?? 0;
      const active = Math.abs(pnl) > 4;
      const isBuy = index % 2 === 0;
      return {
        id: `bot-${index + 1}`,
        name,
        active,
        state: active ? (isBuy ? "long" : "short") : "flat" as const,
        symbol: active ? (["USTEC", "USTEC", "XAUUSD", "XAUUSD", "DE40", "US500"] as const)[index] : null,
        pnl,
        closedPnl,
        profit: pnl,
        swap: 0,
        commission: 0,
        volume: active ? [0.6, 0.6, 0.04, 0.15][index] : 0,
        openPositions: active ? 1 : 0,
        exposurePct: active ? [18, 27, 13, 22, 9, 15][index] ?? 0 : 0,
        balanceUsagePct: active ? [18, 27, 13, 22, 9, 15][index] ?? 0 : 0,
        floatingReturnPct: Number((pnl / 1350 * 100).toFixed(3)),
        closedReturnPct: Number((closedPnl / 1350 * 100).toFixed(3)),
        totalReturnPct: Number(((pnl + closedPnl) / 1350 * 100).toFixed(3)),
        closedTrades: [42, 18, 61, 12, 7, 33][index] ?? 0,
        winRatePct: [64.3, 55.6, 70.5, 50.0, 71.4, 57.6][index] ?? 0,
        pnlVelocity: 0,
        marketVelocity: 0,
        priceAverage: active ? [30279.5, 30377.2, 4184.99, 2380.4, 18750.3, 6480.8][index] : null,
        priceCurrent: active ? [30304.7, 30305.7, 4188.87, 2381.2, 18761.5, 6478.2][index] : null,
        positions: active ? [{
          ticket: 900000000 + index,
          symbol: (["USTEC", "USTEC", "XAUUSD", "XAUUSD", "DE40", "US500"] as const)[index],
          side: (isBuy ? "buy" : "sell") as "buy" | "sell",
          volume: [0.6, 0.6, 0.04, 0.15, 1.0, 0.5][index],
          priceOpen: [30279.5, 30377.2, 4184.99, 2380.4, 18750.3, 6480.8][index],
          priceCurrent: [30304.7, 30305.7, 4188.87, 2381.2, 18761.5, 6478.2][index],
          profit: pnl,
        }] : [],
        updatedAt: now,
      };
    }),
  };
}
