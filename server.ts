import { createServer } from "node:http";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";
import { telemetrySchema, type Bot, type Telemetry } from "./lib/schema";
import { mockTelemetry } from "./server/mock";

type RawPosition = {
  ticket?: string | number;
  symbol?: string;
  type?: string | number;
  volume?: number;
  profit?: number;
  swap?: number;
  commission?: number;
  time?: number;
};

type RawAgent = {
  positions?: RawPosition[];
  exposurePct?: number;
  exposure_pct?: number;
};

type RawTelemetry = {
  status?: { connected?: boolean; last_error?: string; timestamp?: string };
  account?: { balance?: number; equity?: number; profit?: number; currency?: string };
  positions?: RawPosition[];
  agents?: Record<string, RawAgent>;
  ticks?: Record<string, { time?: number; time_msc?: number }>;
};

const definitions = [
  { id: "bot-1", name: "NQ-ALPHA", symbol: "USTEC" },
  { id: "bot-2", name: "NQ-SIGMA", symbol: "USTEC" },
  { id: "bot-3", name: "XAU-PRIME", symbol: "XAUUSD" },
  { id: "bot-4", name: "XAU-FLASH", symbol: "XAUUSD" },
] as const;

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const initialBalance = positiveNumber(process.env.INITIAL_BALANCE, 1350);
const app = next({ dev });

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function symbolMatches(value: string | undefined, expected: string): boolean {
  const symbol = (value ?? "").toUpperCase();
  return symbol === expected || (expected === "USTEC" && ["NAS100", "NQ100", "US100", "NDX"].some((alias) => symbol.includes(alias)));
}

function positionPnl(position: RawPosition): number {
  return numberValue(position.profit) + numberValue(position.swap) + numberValue(position.commission);
}

function sideFor(positions: RawPosition[]): Bot["side"] {
  const type = String(positions[0]?.type ?? "").toLowerCase();
  if (type === "0" || type === "buy") return "long";
  if (type === "1" || type === "sell") return "short";
  return "flat";
}

function fallbackPositions(raw: RawTelemetry, definitionIndex: number): RawPosition[] {
  const definition = definitions[definitionIndex];
  const group = definitions.filter((item) => item.symbol === definition.symbol);
  const groupIndex = group.findIndex((item) => item.id === definition.id);
  const positions = (raw.positions ?? []).filter((position) => symbolMatches(position.symbol, definition.symbol));
  return positions.filter((_, positionIndex) => positionIndex % group.length === groupIndex);
}

function normalizeHttpTelemetry(raw: RawTelemetry): Telemetry {
  const now = new Date().toISOString();
  const connected = raw.status?.connected === true && numberValue(raw.account?.balance) > 0;
  const bots = definitions.map((definition, index) => {
    const agent = raw.agents?.[definition.name];
    const positions = Array.isArray(agent?.positions) ? agent.positions : fallbackPositions(raw, index);
    const pnl = positions.reduce((total, position) => total + positionPnl(position), 0);
    const exposure = numberValue(agent?.exposurePct ?? agent?.exposure_pct);
    return {
      id: definition.id,
      name: definition.name,
      pnl: Number(pnl.toFixed(2)),
      exposurePct: Math.max(0, Math.min(100, exposure)),
      side: sideFor(positions),
      updatedAt: raw.status?.timestamp ?? now,
    } satisfies Bot;
  });

  return telemetrySchema.parse({
    type: "telemetry",
    balance: connected ? numberValue(raw.account?.balance, initialBalance) : initialBalance,
    initialBalance,
    currency: raw.account?.currency ?? "EUR",
    timestamp: raw.status?.timestamp ?? now,
    source: "bridge",
    bridgeConnected: connected,
    bots,
  });
}

function normalizeWebSocketTelemetry(raw: unknown): Telemetry | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = { ...(raw as Record<string, unknown>), source: "bridge", bridgeConnected: true };
  const result = telemetrySchema.safeParse(candidate);
  return result.success ? result.data : null;
}

function offlineTelemetry(): Telemetry {
  const now = new Date().toISOString();
  return {
    type: "telemetry",
    balance: initialBalance,
    initialBalance,
    currency: "EUR",
    timestamp: now,
    source: "bridge",
    bridgeConnected: false,
    bots: definitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
      pnl: 0,
      exposurePct: 0,
      side: "flat" as const,
      updatedAt: now,
    })),
  };
}

async function main() {
  await app.prepare();
  const handle = app.getRequestHandler();
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Pragma", "no-cache");
    return handle(request, response);
  });
  const wss = new WebSocketServer({ noServer: true });
  let latest: Telemetry = mockTelemetry(0);
  let mockTick = 0;
  let bridgeRetry = 0;
  let bridgeTimer: ReturnType<typeof setTimeout> | undefined;
  let httpTimer: ReturnType<typeof setTimeout> | undefined;

  const broadcast = (data: Telemetry) => {
    latest = telemetrySchema.parse(data);
    const body = JSON.stringify(latest);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(body);
    }
  };

  const scheduleBridgeReconnect = (connect: () => void) => {
    const delay = Math.min(30000, 1000 * 2 ** bridgeRetry++);
    bridgeTimer = setTimeout(connect, delay);
  };

  const connectWebSocketBridge = () => {
    const url = process.env.MT5_BRIDGE_WS_URL;
    if (!url) return;
    const bridgeSocket = new WebSocket(url, {
      headers: { Authorization: `Bearer ${process.env.BRIDGE_TOKEN ?? process.env.MT5_BRIDGE_TOKEN ?? ""}` },
    });
    bridgeSocket.on("open", () => {
      bridgeRetry = 0;
      console.log("Connected to MT5 telemetry WebSocket bridge");
    });
    bridgeSocket.on("message", (raw) => {
      try {
        const data = normalizeWebSocketTelemetry(JSON.parse(raw.toString()));
        if (data) broadcast(data);
        else console.error("Rejected bridge payload: schema mismatch");
      } catch (error) {
        console.error("Rejected bridge payload:", error instanceof Error ? error.message : "invalid JSON");
      }
    });
    bridgeSocket.on("close", () => {
      broadcast(offlineTelemetry());
      scheduleBridgeReconnect(connectWebSocketBridge);
    });
    bridgeSocket.on("error", (error) => console.error("Bridge error:", error.message));
  };

  const pollHttpBridge = async (): Promise<void> => {
    const baseUrl = (process.env.MT5_BRIDGE_HTTP_URL ?? "").replace(/\/+$/, "");
    if (!baseUrl) return;
    try {
      const token = (process.env.BRIDGE_TOKEN ?? process.env.MT5_BRIDGE_TOKEN)?.trim();
      const response = await fetch(`${baseUrl}/telemetry`, {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json() as RawTelemetry;
      broadcast(normalizeHttpTelemetry(raw));
    } catch (error) {
      broadcast(offlineTelemetry());
      console.error("HTTP bridge error:", error instanceof Error ? error.message : error);
    } finally {
      httpTimer = setTimeout(() => void pollHttpBridge(), Number(process.env.MT5_BRIDGE_POLL_INTERVAL ?? 1000));
    }
  };

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify(latest));
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }, 25000);
    socket.on("close", () => clearInterval(heartbeat));
  });

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") return socket.destroy();
    const allowedOrigin = process.env.WS_ALLOWED_ORIGIN;
    if (allowedOrigin && request.headers.origin !== allowedOrigin) return socket.destroy();
    wss.handleUpgrade(request, socket, head, (client) => wss.emit("connection", client, request));
  });

  const source = process.env.DATA_SOURCE ?? "mock";
  if (source === "bridge" && process.env.MT5_BRIDGE_WS_URL) {
    latest = offlineTelemetry();
    connectWebSocketBridge();
  } else if (source === "bridge" && process.env.MT5_BRIDGE_HTTP_URL) {
    latest = offlineTelemetry();
    void pollHttpBridge();
  } else if (source === "bridge") {
    throw new Error("Bridge mode requires MT5_BRIDGE_WS_URL or MT5_BRIDGE_HTTP_URL");
  } else {
    setInterval(() => broadcast(mockTelemetry(++mockTick)), 1000);
  }

  server.listen(port, host, () => console.log(`Quantora Orbit on http://${host}:${port}`));
  void bridgeTimer;
  void httpTimer;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
