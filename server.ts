import { createServer } from "node:http";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";
import { telemetrySchema, type Bot, type Telemetry } from "./lib/schema";
import { mockTelemetry } from "./server/mock";

type RawPosition = {
  symbol?: string;
  type?: string | number;
  volume?: number;
  profit?: number;
  swap?: number;
  commission?: number;
  price_open?: number;
  price_current?: number;
};

type RawBot = Partial<Bot> & { updatedAt?: string | number };
type RawTelemetry = {
  status?: { connected?: boolean; timestamp?: string | number; last_error?: string | null };
  account?: { balance?: number; equity?: number; currency?: string } | null;
  balance?: number;
  equity?: number;
  floatingPnl?: number;
  startingBalance?: number;
  totalReturn?: number;
  totalReturnPct?: number;
  bots?: RawBot[];
  positions?: RawPosition[];
  timestamp?: string | number;
};

type BotIdentity = { id: string; name: string };

const botIdentities: BotIdentity[] = [1, 2, 3, 4].map((index) => ({
  id: `bot-${index}`,
  name: process.env[`BOT_${index}_NAME`]?.trim() ?? "",
}));

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const startingBalance = 1350;
const staleAfterMs = 5000;
const disconnectedAfterMs = 15000;
const app = next({ dev });

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoTimestamp(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
  }
  const numeric = numberValue(value, 0);
  if (numeric > 0) return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric).toISOString();
  return fallback;
}

function emptyBot(identity: BotIdentity, now: string): Bot {
  return {
    id: identity.id,
    name: identity.name || `Bot ${identity.id.replace("bot-", "")}`,
    active: false,
    state: "flat",
    symbol: null,
    pnl: 0,
    profit: 0,
    swap: 0,
    commission: 0,
    volume: 0,
    openPositions: 0,
    exposurePct: 0,
    balanceUsagePct: 0,
    pnlVelocity: 0,
    marketVelocity: 0,
    priceAverage: null,
    priceCurrent: null,
    updatedAt: now,
  };
}

function normalizeBot(raw: RawBot | undefined, identity: BotIdentity, now: string): Bot {
  const result = telemetrySchema.shape.bots.element.safeParse({
    ...emptyBot(identity, now),
    ...raw,
    id: identity.id,
    name: identity.name || (typeof raw?.name === "string" && raw.name.trim() ? raw.name : `Bot ${identity.id.replace("bot-", "")}`),
    updatedAt: isoTimestamp(raw?.updatedAt ?? now, now),
  });
  return result.success ? result.data : emptyBot(identity, now);
}

function normalizeHttpTelemetry(raw: RawTelemetry): Telemetry {
  const now = new Date().toISOString();
  const accountBalance = numberValue(raw.account?.balance ?? raw.balance);
  const balance = numberValue(raw.balance ?? raw.account?.balance);
  const equity = numberValue(raw.equity ?? raw.account?.equity, balance);
  const floatingPnl = numberValue(raw.floatingPnl, equity - balance);
  const timestamp = isoTimestamp(raw.timestamp ?? raw.status?.timestamp, now);
  const sourceBots = Array.isArray(raw.bots) ? raw.bots : [];
  const bots = botIdentities.map((identity, index) => normalizeBot(sourceBots[index], identity, timestamp));
  const connected = raw.status?.connected === true && (balance > 0 || accountBalance > 0);
  const actualBalance = balance || accountBalance;
  const totalReturn = numberValue(raw.totalReturn, actualBalance - startingBalance);
  const totalReturnPct = numberValue(raw.totalReturnPct, startingBalance ? totalReturn / startingBalance * 100 : 0);

  return telemetrySchema.parse({
    type: "telemetry",
    balance: actualBalance,
    equity,
    floatingPnl,
    startingBalance,
    totalReturn,
    totalReturnPct,
    currency: raw.account?.currency ?? "EUR",
    timestamp,
    source: "bridge",
    bridgeConnected: connected,
    connectionState: connected ? "connected" : "disconnected",
    bots,
  });
}

function normalizeWebSocketTelemetry(raw: unknown): Telemetry | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const result = telemetrySchema.safeParse({ ...candidate, source: "bridge" });
  return result.success ? result.data : null;
}

function withConnectionState(data: Telemetry, state: Telemetry["connectionState"]): Telemetry {
  return telemetrySchema.parse({ ...data, bridgeConnected: state === "connected", connectionState: state });
}

function offlineTelemetry(state: "stale" | "disconnected", last: Telemetry | null): Telemetry {
  const now = new Date().toISOString();
  if (last) {
    const safeBots = last.bots.map((bot) => ({
      ...bot,
      active: false,
      state: "flat" as const,
      symbol: null,
      pnl: 0,
      profit: 0,
      swap: 0,
      commission: 0,
      volume: 0,
      openPositions: 0,
      exposurePct: 0,
      balanceUsagePct: 0,
      pnlVelocity: 0,
      marketVelocity: 0,
      priceAverage: null,
      priceCurrent: null,
      updatedAt: now,
    }));
    return withConnectionState({ ...last, balance: 0, equity: 0, floatingPnl: 0, totalReturn: 0, totalReturnPct: 0, timestamp: now, bots: safeBots }, state);
  }
  return telemetrySchema.parse({
    type: "telemetry",
    balance: 0,
    equity: 0,
    floatingPnl: 0,
    startingBalance,
    totalReturn: 0,
    totalReturnPct: 0,
    currency: "EUR",
    timestamp: now,
    source: "bridge",
    bridgeConnected: false,
    connectionState: state,
    bots: botIdentities.map((identity) => emptyBot(identity, now)),
  });
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
  let lastBridgeAt = 0;
  let lastBridgeData: Telemetry | null = null;

  const broadcast = (data: Telemetry) => {
    latest = telemetrySchema.parse(data);
    const body = JSON.stringify(latest);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(body);
    }
  };

  const broadcastBridgeStatus = () => {
    const age = lastBridgeAt ? Date.now() - lastBridgeAt : disconnectedAfterMs;
    broadcast(offlineTelemetry(age >= disconnectedAfterMs ? "disconnected" : "stale", lastBridgeData));
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
        if (data) {
          lastBridgeAt = Date.now();
          lastBridgeData = data;
          broadcast(data);
        } else {
          console.error("Rejected bridge payload: schema mismatch");
        }
      } catch (error) {
        console.error("Rejected bridge payload:", error instanceof Error ? error.message : "invalid JSON");
      }
    });
    bridgeSocket.on("close", () => {
      broadcastBridgeStatus();
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
      const data = normalizeHttpTelemetry(raw);
      lastBridgeAt = Date.now();
      lastBridgeData = data;
      broadcast(data);
    } catch (error) {
      broadcastBridgeStatus();
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
    latest = offlineTelemetry("disconnected", null);
    connectWebSocketBridge();
  } else if (source === "bridge" && process.env.MT5_BRIDGE_HTTP_URL) {
    latest = offlineTelemetry("disconnected", null);
    void pollHttpBridge();
  } else if (source === "bridge") {
    throw new Error("Bridge mode requires MT5_BRIDGE_WS_URL or MT5_BRIDGE_HTTP_URL");
  } else {
    setInterval(() => broadcast(mockTelemetry(++mockTick)), 1000);
  }

  server.listen(port, host, () => console.log(`Quantora Orbit on http://${host}:${port}`));
  const freshnessTimer = setInterval(() => {
    if (source === "bridge" && lastBridgeAt > 0 && Date.now() - lastBridgeAt >= staleAfterMs) broadcastBridgeStatus();
  }, 1000);
  void bridgeTimer;
  void httpTimer;
  void freshnessTimer;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
