# Quantora Orbit

Quantora Orbit is a cinematic real-time command center for four MetaTrader 5 Expert Advisors. The repository now runs the complete Next.js 15 + React 19 + TypeScript application from the supplied archive, with a persistent Node server and browser WebSocket endpoint.

## Current status

- The archive was present at `quantora-orbit.zip` and verified as a valid 20-file package.
- Its application files are installed at the repository root.
- Mock telemetry is the safe default, so the web app can start without a terminal or account credentials.
- The existing Python FastAPI read-only MT5 adapter remains available and can feed Orbit through `MT5_BRIDGE_HTTP_URL`.
- MT5 credentials are server-side configuration only and are never sent to the browser.
- The HTTP bridge supports an optional bearer token through `BRIDGE_TOKEN` (`MT5_BRIDGE_TOKEN` remains supported for compatibility).

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000`. The preview shows four animated entities, PnL-driven visual states, Cinema mode, optional Web Audio, and local Moments history. Mock data is explicitly labelled `SIMULACIÓN`.

## Connect the existing MT5 adapter

The repository already contains a read-only FastAPI adapter under `api/` and `mt5_bridge/`. Run that adapter on the same machine as the logged-in MT5 desktop terminal, then configure Orbit with:

```text
DATA_SOURCE=bridge
MT5_BRIDGE_HTTP_URL=https://your-laptop-bridge.example.com
BRIDGE_TOKEN=use-the-same-long-random-token-on-both-sides
MT5_LOGIN=your_login
MT5_PASSWORD=your_password
MT5_SERVER=ICMarketsEU-MT5-5
INITIAL_BALANCE=1350
```

The adapter exposes `/telemetry`; Orbit polls it server-side and converts account, agent positions, and MT5 status into the normalized four-bot WebSocket contract. If the adapter is unavailable, Orbit shows `MT5 OFFLINE` and does not label mock values as live. When `BRIDGE_TOKEN` (or the compatibility name `MT5_BRIDGE_TOKEN`) is set, both `/health` and `/telemetry` require `Authorization: Bearer <token>`.

For a laptop connection, keep MT5 and the FastAPI bridge running on the same Windows machine, then expose only port `8000` through a secure tunnel such as Cloudflare Tunnel. Set the tunnel's upstream service to `http://127.0.0.1:8000`; do not expose the MT5 terminal or open router ports. The MT5 terminal and Python adapter must run on a machine that can access the broker terminal. A cloud browser workspace cannot create a desktop MT5 session by itself.

## Use a normalized WebSocket bridge

For a separate private bridge, set:

```text
DATA_SOURCE=bridge
MT5_BRIDGE_WS_URL=wss://your-private-bridge.example/ws
MT5_BRIDGE_TOKEN=replace-with-a-long-random-token
WS_ALLOWED_ORIGIN=https://your-dashboard.example
```

The bridge must send four-bot messages shaped like:

```json
{
  "type": "telemetry",
  "balance": 1522.45,
  "initialBalance": 1350,
  "currency": "EUR",
  "timestamp": "2026-09-03T08:00:00.000Z",
  "bots": [
    {"id":"bot-1","name":"EA One","pnl":22.4,"exposurePct":18,"side":"long","updatedAt":"2026-09-03T08:00:00.000Z"},
    {"id":"bot-2","name":"EA Two","pnl":-8.2,"exposurePct":24,"side":"short","updatedAt":"2026-09-03T08:00:00.000Z"},
    {"id":"bot-3","name":"EA Three","pnl":0,"exposurePct":0,"side":"flat","updatedAt":"2026-09-03T08:00:00.000Z"},
    {"id":"bot-4","name":"EA Four","pnl":31.7,"exposurePct":16,"side":"long","updatedAt":"2026-09-03T08:00:00.000Z"}
  ]
}
```

Orbit validates every incoming bridge message with Zod and reconnects with exponential backoff. Never prefix secrets with `NEXT_PUBLIC_`.

## Production

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run start
```

The custom server binds to `0.0.0.0` and reads the platform-provided `PORT`. Docker and Docker Compose definitions are included for a long-running WebSocket-capable deployment. A reverse proxy must support WebSocket upgrades and HTTPS.

## Security

- Keep `.env`, `.env.local`, and bridge tokens out of Git.
- Store MT5 login/password and bridge tokens in the platform environment settings.
- Rotate credentials that have been exposed in chat, screenshots, logs, or Git history.
- Use `https://`, a long random bridge token, an origin allowlist, and network allowlisting in production.
- This app is read-only: the included adapter does not open or close trades.

## Files

- `app/` — Next.js App Router page and global styles.
- `components/` — WebSocket provider, HUD, shaders, and Three.js scene.
- `server.ts` — persistent Next.js + WebSocket server and bridge adapters.
- `server/mock.ts` — deterministic local telemetry source.
- `lib/schema.ts` — shared Zod validation contract.
- `api/` and `mt5_bridge/` — existing read-only Python MT5 adapter.
- `start_mision_control.py` and `start_mision_control.bat` — Windows bridge launchers.
- `.env.example` — archive template; `env.example.txt` also contains the workspace-safe configuration reference.
