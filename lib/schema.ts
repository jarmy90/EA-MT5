import { z } from "zod";

export const positionSchema = z.object({
  ticket: z.number().int(),
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  volume: z.number().nonnegative(),
  priceOpen: z.number().nullable(),
  priceCurrent: z.number().nullable(),
  profit: z.number(),
});

export const botSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  state: z.enum(["flat", "long", "short", "mixed"]),
  symbol: z.string().nullable(),
  pnl: z.number(),
  closedPnl: z.number(),
  profit: z.number(),
  swap: z.number(),
  commission: z.number(),
  volume: z.number().nonnegative(),
  openPositions: z.number().int().nonnegative(),
  exposurePct: z.number().min(0),
  balanceUsagePct: z.number().min(0),
  floatingReturnPct: z.number(),
  closedReturnPct: z.number(),
  totalReturnPct: z.number(),
  closedTrades: z.number().int().nonnegative(),
  winRatePct: z.number().nonnegative(),
  pnlVelocity: z.number(),
  marketVelocity: z.number().nonnegative(),
  priceAverage: z.number().nullable(),
  priceCurrent: z.number().nullable(),
  positions: z.array(positionSchema),
  updatedAt: z.string(),
});

export const telemetrySchema = z.object({
  type: z.literal("telemetry"),
  balance: z.number().finite(),
  equity: z.number().finite(),
  floatingPnl: z.number().finite(),
  margin: z.number().finite().nonnegative(),
  marginFree: z.number().finite().nonnegative(),
  marginLevel: z.number().finite().nonnegative(),
  leverage: z.number().int().nonnegative(),
  openPositions: z.number().int().nonnegative(),
  startingBalance: z.number().positive(),
  totalReturn: z.number().finite(),
  totalReturnPct: z.number().finite(),
  totalReturnBase: z.string().optional(),
  currency: z.string(),
  bots: z.array(botSchema).min(1).max(12),
  timestamp: z.string(),
  source: z.enum(["mock", "bridge"]),
  bridgeConnected: z.boolean(),
  connectionState: z.enum(["connected", "stale", "disconnected"]),
});

export type Position = z.infer<typeof positionSchema>;
export type Bot = z.infer<typeof botSchema>;
export type Telemetry = z.infer<typeof telemetrySchema>;
