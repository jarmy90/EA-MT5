import { z } from "zod";

export const botSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  state: z.enum(["flat", "long", "short", "mixed"]),
  symbol: z.string().nullable(),
  pnl: z.number(),
  profit: z.number(),
  swap: z.number(),
  commission: z.number(),
  volume: z.number().nonnegative(),
  openPositions: z.number().int().nonnegative(),
  exposurePct: z.number().min(0),
  balanceUsagePct: z.number().min(0),
  pnlVelocity: z.number(),
  marketVelocity: z.number().nonnegative(),
  priceAverage: z.number().nullable(),
  priceCurrent: z.number().nullable(),
  updatedAt: z.string(),
});

export const telemetrySchema = z.object({
  type: z.literal("telemetry"),
  balance: z.number().finite(),
  equity: z.number().finite(),
  floatingPnl: z.number().finite(),
  startingBalance: z.number().positive(),
  totalReturn: z.number().finite(),
  totalReturnPct: z.number().finite(),
  currency: z.string(),
  bots: z.array(botSchema).length(4),
  timestamp: z.string(),
  source: z.enum(["mock", "bridge"]),
  bridgeConnected: z.boolean(),
  connectionState: z.enum(["connected", "stale", "disconnected"]),
});

export type Bot = z.infer<typeof botSchema>;
export type Telemetry = z.infer<typeof telemetrySchema>;
