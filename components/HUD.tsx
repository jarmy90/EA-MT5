"use client";

import { useEffect, useRef } from "react";
import { useTelemetry } from "./WebSocketProvider";

export function HUD() {
  const { data, connected, selected, setSelected, cinema, setCinema, sound, setSound, moments } = useTelemetry();
  const audio = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const upstreamLive = data?.source === "bridge" && data.bridgeConnected;

  useEffect(() => {
    if (!sound) {
      void audio.current?.close();
      audio.current = null;
      gain.current = null;
      return;
    }
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const node = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 90;
    node.gain.value = 0.012;
    oscillator.connect(node).connect(context.destination);
    oscillator.start();
    audio.current = context;
    gain.current = node;
    return () => {
      void context.close();
    };
  }, [sound]);

  useEffect(() => {
    if (gain.current && audio.current && data) {
      const total = data.balance - data.initialBalance;
      gain.current.gain.setTargetAtTime(
        Math.max(0.003, Math.min(0.025, 0.01 + total / 20000)),
        audio.current.currentTime,
        0.8,
      );
    }
  }, [data]);

  const profit = data ? data.balance - data.initialBalance : 0;
  const percentage = data ? (profit / data.initialBalance) * 100 : 0;
  const bot = data?.bots.find((item) => item.id === selected);
  const connectionLabel = upstreamLive ? "MT5 LIVE" : data?.source === "mock" ? "SIMULACIÓN" : connected ? "MT5 OFFLINE" : "RECONECTANDO";

  return (
    <div className="hud" onClick={() => setSelected(null)}>
      <div className="top">
        <div className="glass brand">QUANTORA · ORBIT</div>
        <div className="glass metrics">
          <Metric label="Balance" value={data ? `${data.balance.toFixed(2)} €` : "—"} />
          <Metric label="Resultado total" value={`${profit >= 0 ? "+" : ""}${profit.toFixed(2)} €`} cls={profit >= 0 ? "positive" : "negative"} />
          <Metric label="Rentabilidad" value={`${percentage >= 0 ? "+" : ""}${percentage.toFixed(2)}%`} cls={percentage >= 0 ? "positive" : "negative"} />
          <span className={`live ${upstreamLive ? "" : "upstream-offline"}`}>
            <i className="status" />
            {connectionLabel}
          </span>
        </div>
      </div>

      <div className="bottom">
        <div>
          {bot && (
            <div className="glass detail" onClick={(event) => event.stopPropagation()}>
              <small>Entidad seleccionada</small>
              <h2>{bot.name}</h2>
              <div className="detail-grid">
                <Metric label="PnL flotante" value={`${bot.pnl.toFixed(2)} €`} cls={bot.pnl >= 0 ? "positive" : "negative"} />
                <Metric label="Exposición" value={`${bot.exposurePct.toFixed(1)}%`} />
                <Metric label="Dirección" value={bot.side.toUpperCase()} />
                <Metric label="Actualizado" value={new Date(bot.updatedAt).toLocaleTimeString()} />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="glass controls" onClick={(event) => event.stopPropagation()}>
            <button className={cinema ? "active" : ""} onClick={() => setCinema(!cinema)}>◉ Cinema</button>
            <button className={sound ? "active" : ""} onClick={() => setSound(!sound)}>♫ Sonido</button>
          </div>
          {moments.length > 0 && (
            <div className="glass moments">
              <small>MOMENTOS</small>
              {moments.map((moment, index) => <div key={`${moment}-${index}`}>{moment}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return <div className="metric"><small>{label}</small><strong className={cls}>{value}</strong></div>;
}
