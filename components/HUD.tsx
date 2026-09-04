"use client";

import { useEffect, useRef } from "react";
import { useTelemetry } from "./WebSocketProvider";

export function HUD() {
  const { data, connected, selected, setSelected, cinema, setCinema, sound, setSound, moments } = useTelemetry();
  const audio = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const live = data?.source === "bridge" && data.connectionState === "connected" && data.bridgeConnected;
  const demo = data?.source === "mock";

  useEffect(() => {
    if (!sound) { void audio.current?.close(); audio.current = null; gain.current = null; return; }
    const context = new AudioContext(); const oscillator = context.createOscillator(); const node = context.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = 90; node.gain.value = 0.012; oscillator.connect(node).connect(context.destination); oscillator.start();
    audio.current = context; gain.current = node; return () => { void context.close(); };
  }, [sound]);

  useEffect(() => {
    if (gain.current && audio.current && data) {
      gain.current.gain.setTargetAtTime(Math.max(0.003, Math.min(0.025, 0.01 + data.totalReturn / 20000)), audio.current.currentTime, 0.8);
    }
  }, [data]);

  const connectionLabel = demo ? "DEMO DATA · SIMULACIÓN" : live ? "MT5 CONNECTED · BRIDGE CONNECTED" : data?.connectionState === "stale" ? "STALE DATA" : connected ? "BRIDGE DISCONNECTED" : "RECONNECTING";
  const bot = data?.bots.find((item) => item.id === selected);

  return (
    <div className="hud" onClick={() => setSelected(null)}>
      <div className="top">
        <div className="glass brand">QUANTORA · ORBIT</div>
        <div className="glass metrics">
          <Metric label="Balance" value={data ? `${data.balance.toFixed(2)} ${data.currency}` : "—"} />
          <Metric label="Equity" value={data ? `${data.equity.toFixed(2)} ${data.currency}` : "—"} />
          <Metric label="Resultado total" value={data ? `${data.totalReturn >= 0 ? "+" : ""}${data.totalReturn.toFixed(2)} ${data.currency}` : "—"} cls={(data?.totalReturn ?? 0) >= 0 ? "positive" : "negative"} />
          <span className={`live ${live ? "" : "upstream-offline"}`}><i className="status" />{connectionLabel}</span>
        </div>
      </div>

      <div className="bottom">
        <div>{bot && <div className="glass detail" onClick={(event) => event.stopPropagation()}>
          <small>Entidad seleccionada</small><h2>{bot.name}</h2>
          <div className="detail-grid">
            <Metric label="Estado" value={bot.active ? bot.state.toUpperCase() : "SIN POSICIÓN"} />
            <Metric label="Símbolo" value={bot.symbol ?? "—"} />
            <Metric label="PnL real" value={`${bot.pnl.toFixed(2)} ${data?.currency ?? "EUR"}`} cls={bot.pnl >= 0 ? "positive" : "negative"} />
            <Metric label="Volumen" value={bot.volume.toFixed(4)} />
            <Metric label="Posiciones" value={String(bot.openPositions)} />
            <Metric label="Exposición" value={`${bot.exposurePct.toFixed(2)}%`} />
            <Metric label="Velocidad PnL" value={`${bot.pnlVelocity.toFixed(4)}/s`} />
            <Metric label="Velocidad mercado" value={`${bot.marketVelocity.toFixed(4)} ticks/s`} />
            <Metric label="Precio medio" value={bot.priceAverage?.toFixed(5) ?? "—"} />
            <Metric label="Precio actual" value={bot.priceCurrent?.toFixed(5) ?? "—"} />
            <Metric label="Última actualización" value={new Date(bot.updatedAt).toLocaleTimeString()} />
          </div>
          {!bot.active && <p className="hint">{data?.connectionState === "connected" ? "BOT CONECTADO · SIN POSICIÓN ABIERTA · ESPERANDO SEÑAL" : "BRIDGE DISCONNECTED · SIN DATOS ACTIVOS"}</p>}
        </div>}</div>

        <div><div className="glass controls" onClick={(event) => event.stopPropagation()}><button className={cinema ? "active" : ""} onClick={() => setCinema(!cinema)}>◉ Cinema</button><button className={sound ? "active" : ""} onClick={() => setSound(!sound)}>♫ Sonido</button></div>
          {moments.length > 0 && <div className="glass moments"><small>MOMENTOS</small>{moments.map((moment, index) => <div key={`${moment}-${index}`}>{moment}</div>)}</div>}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return <div className="metric"><small>{label}</small><strong className={cls}>{value}</strong></div>;
}
