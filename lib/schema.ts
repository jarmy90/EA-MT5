import { z } from "zod";

export const botSchema = z.object({
  id: z.string(),
  name: z.string(),
  pnl: z.number(),
  exposurePct: z.number().min(0).max(100),
  side: z.enum(["flat", "long", "short"]),
  updatedAt: z.string(),
});

export const telemetrySchema = z.object({
  type: z.literal("telemetry"),
  balance: z.number().positive(),
  initialBalance: z.number().positive(),
  currency: z.string().default("EUR"),
  bots: z.array(botSchema).length(4),
  timestamp: z.string(),
  source: z.enum(["mock", "bridge"]).default("mock"),
  bridgeConnected: z.boolean().default(true),
});

export type Bot = z.infer<typeof botSchema>;
export type Telemetry = z.infer<typeof telemetrySchema>;
