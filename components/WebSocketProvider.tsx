"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { telemetrySchema, type Telemetry } from "@/lib/schema";

type ContextValue = {
  data: Telemetry | null;
  connected: boolean;
  selected: string | null;
  setSelected: (id: string | null) => void;
  cinema: boolean;
  setCinema: (value: boolean) => void;
  sound: boolean;
  setSound: (value: boolean) => void;
  moments: string[];
};

const TelemetryContext = createContext<ContextValue | null>(null);
const MOMENTS_KEY = "orbit-moments";

function readMoments(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MOMENTS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Telemetry | null>(null);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [cinema, setCinema] = useState(false);
  const [sound, setSound] = useState(false);
  const [moments, setMoments] = useState<string[]>([]);
  const retry = useRef(0);
  const lastPnl = useRef<Record<string, number>>({});

  useEffect(() => {
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;
      const url = configuredUrl ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
      socket = new WebSocket(url);
      socket.onopen = () => {
        retry.current = 0;
        setConnected(true);
      };
      socket.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          const result = telemetrySchema.safeParse(parsed);
          if (!result.success) return;
          const next = result.data;
          setData(next);
          next.bots.forEach((bot) => {
            if (bot.pnl >= 50 && (lastPnl.current[bot.id] ?? -Infinity) < 50) {
              const moment = `${new Date().toLocaleTimeString()} · ${bot.name} +${bot.pnl.toFixed(2)} €`;
              const nextMoments = [moment, ...readMoments()].slice(0, 8);
              setMoments(nextMoments);
              localStorage.setItem(MOMENTS_KEY, JSON.stringify(nextMoments));
            }
            lastPnl.current[bot.id] = bot.pnl;
          });
        } catch {
          // Ignore malformed frames; the server validates before broadcasting.
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) {
          const delay = Math.min(10000, 1000 * 2 ** retry.current++);
          timer = setTimeout(connect, delay);
        }
      };
    };

    connect();
    setMoments(readMoments());
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, []);

  const value = useMemo(
    () => ({ data, connected, selected, setSelected, cinema, setCinema, sound, setSound, moments }),
    [data, connected, selected, cinema, sound, moments],
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const value = useContext(TelemetryContext);
  if (!value) throw new Error("WebSocketProvider is missing");
  return value;
}
