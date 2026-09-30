"use client";

import { useEffect, useRef } from "react";
import { useTelemetry } from "./WebSocketProvider";

export function HUD() {
  const { data, connected, selected, setSelected, sound, setSound } = useTelemetry();
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

  const connectionLabel = demo ? "DEMO · SIMULACIÓN" : live ? "MT5 LIVE" : data?.connectionState === "stale" ? "DATOS ANTIGUOS" : connected ? "PUENTE DESCONECTADO" : "RECONECTANDO";
  const bridgeError = live ? null : data?.bridgeError ?? null;
  const pct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  return (
    <div className="dash" onClick={() => setSelected(null)}>
      <header className="dash-top">
        <div className="brand-block">
          <div className="brand-title">QUANTORA · ORBIT</div>
          <div className="brand-sub">Four EAs · One trading system · Datos en tiempo real</div>
        </div>
        <div className="status-block">
          <span className={`live ${live ? "" : "upstream-offline"}`}><i className="status" />{connectionLabel}</span>
          {!live && bridgeError && <span className="err-detail">MT5: {bridgeError}</span>}
          <div className="controls">
            <button className={sound ? "active" : ""} onClick={() => setSound(!sound)}>♫ Sonido ambiente</button>
          </div>
        </div>
      </header>

      {data && (
        <section className="account" onClick={(event) => event.stopPropagation()}>
          <div className="account-main">
            <div className="metric"><small>Balance</small><strong>{data.balance.toFixed(2)} {data.currency}</strong></div>
            <div className="metric"><small>Equidad</small><strong>{data.equity.toFixed(2)} {data.currency}</strong></div>
            <div className="metric">
              <small>Ganancia total desde {data.startingBalance.toFixed(0)} {data.currency}</small>
              <strong className={(data.totalReturn ?? 0) >= 0 ? "positive" : "negative"}>
                {pct(data.totalReturnPct)} · {data.totalReturn >= 0 ? "+" : ""}{data.totalReturn.toFixed(2)} {data.currency}
              </strong>
            </div>
          </div>
          <div className="account-side">
            <div className="metric"><small>Flotante ahora</small><strong className={data.floatingPnl >= 0 ? "positive" : "negative"}>{data.floatingPnl >= 0 ? "+" : ""}{data.floatingPnl.toFixed(2)} {data.currency}</strong></div>
            <div className="metric"><small>Margen usado</small><strong>{data.margin.toFixed(2)}</strong></div>
            <div className="metric"><small>Margen libre</small><strong>{data.marginFree.toFixed(2)}</strong></div>
            <div className="metric"><small>Nivel de margen</small><strong className={!data.marginLevel || data.marginLevel >= 200 ? "positive" : data.marginLevel >= 100 ? "" : "negative"}>{data.marginLevel > 0 ? `${data.marginLevel.toFixed(1)}%` : "—"}</strong></div>
            <div className="metric"><small>Posiciones abiertas</small><strong>{data.openPositions}{data.leverage ? ` · 1:${data.leverage}` : ""}</strong></div>
          </div>
        </section>
      )}

      <section className="grid" onClick={(event) => event.stopPropagation()}>
        {data?.bots.map((bot) => (
          <article
            key={bot.id}
            className={`card ${selected === bot.id ? "selected" : ""} ${bot.active ? "is-active" : "is-idle"}`}
            onClick={() => setSelected(selected === bot.id ? null : bot.id)}
          >
            <header className="card-head">
              <h2>{bot.name}</h2>
              <span className={`badge ${bot.active ? "on" : "off"}`}>{bot.active ? "ACTIVO" : "EN ESPERA"}</span>
            </header>
            <div className="card-symbol">{bot.symbol ?? "SIN SÍMBOLO"}</div>
            <div className="card-pct">
              <span className={`big ${bot.totalReturnPct >= 0 ? "positive" : "negative"}`}>{pct(bot.totalReturnPct)}</span>
              <span className="of">sobre {data?.startingBalance.toFixed(0) ?? "—"} {data?.currency}</span>
            </div>
            <div className="card-split">
              <div><small>Flotante</small><b className={bot.floatingReturnPct >= 0 ? "positive" : "negative"}>{pct(bot.floatingReturnPct)}</b></div>
              <div><small>Cerrada</small><b className={bot.closedReturnPct >= 0 ? "positive" : "negative"}>{pct(bot.closedReturnPct)}</b></div>
              <div><small>PnL real</small><b className={bot.pnl >= 0 ? "positive" : "negative"}>{bot.pnl >= 0 ? "+" : ""}{bot.pnl.toFixed(2)} {data?.currency ?? "EUR"}</b></div>
            </div>
            <div className="card-stats">
              <div><small>Operaciones</small><b>{bot.closedTrades}</b></div>
              <div><small>Aciertos</small><b>{bot.winRatePct.toFixed(0)}%</b></div>
              <div><small>Abiertas ahora</small><b>{bot.openPositions}</b></div>
              <div><small>Volumen</small><b>{bot.volume.toFixed(2)}</b></div>
            </div>
            {bot.positions.length > 0 && (
              <div className="card-positions">
                {bot.positions.map((position) => (
                  <div className="row" key={position.ticket}>
                    <span className={`side ${position.side === "buy" ? "long" : "short"}`}>{position.side === "buy" ? "▲" : "▼"} {position.side.toUpperCase()}</span>
                    <span className="sym">{position.symbol}</span>
                    <span className="vol">{position.volume.toFixed(2)}</span>
                    <span className="prices">{position.priceOpen?.toFixed(2)} → {position.priceCurrent?.toFixed(2)}</span>
                    <strong className={position.profit >= 0 ? "positive" : "negative"}>{position.profit >= 0 ? "+" : ""}{position.profit.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
            <footer className="card-foot">Actualizado {new Date(bot.updatedAt).toLocaleTimeString()}</footer>
          </article>
        ))}
      </section>

      <footer className="dash-note">Solo lectura · Ninguna orden se envía a MT5 · Datos vía puente local</footer>
    </div>
  );
}
