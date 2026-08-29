# AETHEROPS // Trading Agent Command Center

AETHEROPS is a self-contained, cinematic Mission Control dashboard for four autonomous MetaTrader trading agents. It is intentionally built with zero runtime dependencies: one HTML file, inline CSS, and vanilla JavaScript.

## Open it

Open `index.html` directly in a modern browser. An internet connection is only needed for the optional Orbitron, Rajdhani, and Share Tech Mono Google Fonts; the system remains usable with fallback fonts offline.

## What is included

- Responsive 2×2 fleet station layout for NQ-ALPHA, NQ-SIGMA, XAU-PRIME, and XAU-FLASH
- Simulated balances, P&L, positions, win rate, agent states, activity logs, and uptime
- Demo / Live mode control (Live intentionally reports that the bridge is offline)
- Boot sequence, CRT scanlines, neon glass panels, holographic agent visualizations, progress telemetry, and global activity ticker
- Mock data is kept in a small, clearly marked JavaScript structure for easy replacement

## Design direction

The interface combines aerospace telemetry with cyberpunk HUD language: near-black blue surfaces, restrained grid texture, scanlines, four distinct agent accents, Orbitron display typography, and small monospace system labels. Motion is deliberately lightweight and CSS-driven so the dashboard can remain open continuously without a particle engine or large dependency.

## Real MetaTrader integration

The demo state is defined in the `agents` array inside `index.html`. To connect real data later:

1. Add a small local bridge service or MetaTrader Expert Advisor that exposes sanitized account and agent telemetry.
2. Replace the mock state update in `tick()` with either `fetch('/data.json')` polling or a WebSocket client. The integration seam is marked directly in the source.
3. Keep credentials and order execution on the bridge/server side; never put MetaTrader secrets in this page.
4. Map the bridge payload to each agent's `balance`, `pnl`, `positions`, `winrate`, `status`, `action`, and `task` fields.
5. For production, serve the file from the same origin as the bridge or configure strict CORS and authenticated read-only telemetry endpoints.

A production version should also add server-side authentication, signed telemetry, stale-data detection, and an explicit kill-switch/risk status sourced from the execution layer.
