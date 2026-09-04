# Quantora Orbit Architecture

## Active root application

The only active web application at the repository root is Quantora Orbit:

- Next.js 15.5.2 App Router
- React 19 and TypeScript
- Three.js, React Three Fiber, Drei, Rapier and postprocessing
- `app/page.tsx` and `app/layout.tsx` are the web entrypoint
- `components/` contains the four live sphere entities, scene and HUD
- `lib/schema.ts` validates normalized telemetry
- `server.ts` serves the dashboard and browser WebSocket `/ws`
- `server/mock.ts` supplies deterministic mock telemetry
- Port `3000` is the web port and `/` is the only primary local route

The server binds to `0.0.0.0` for managed hosting. Local Windows launchers open only `http://localhost:3000/`.

## Runtime boundaries

```text
MetaTrader 5 desktop on Windows
  -> official Python MetaTrader5 package
  -> api/main.py FastAPI read-only bridge at 127.0.0.1:8000
  -> HTTPS tunnel exposing only the bridge API
  -> server.ts polls MT5_BRIDGE_HTTP_URL server-side
  -> browser WebSocket ws://host/ws
  -> Quantora Orbit HUD and four sphere entities
```

The browser never connects directly to MT5 and never receives MT5 credentials or `BRIDGE_TOKEN`.

## Bridge boundary

The Python adapter is isolated in `api/` and `mt5_bridge/`. It exposes authenticated `/health` and `/telemetry` routes and reads account, terminal, positions, ticks and rates only. It has no order execution endpoint or trade mutation call. `AGENT_MAP` and the existing attribution helpers map positions to the four visual entities.

The bridge first attempts to use the already-open MT5 terminal session. Login and password variables are optional and remain local environment values only.

## Legacy material

The old Vite/WAWA/Autonomous Business Lab material was moved to `legacy/autonomous-business-lab/`. It is archived for traceability and is not referenced by the active package scripts, Windows launchers, Next.js app, or managed preview. It must not be started as the main application.

Historical documents that mention WAWA remain in `docs/` and at the root as specification/notice records; they are not runtime entrypoints.

## Port and route policy

| Purpose | Address | Status |
| --- | --- | --- |
| Quantora Orbit web | `http://localhost:3000/` | Active |
| Quantora Orbit WebSocket | `ws://localhost:3000/ws` | Active |
| Private MT5 bridge health | `http://127.0.0.1:8000/health` | Active |
| Private MT5 bridge telemetry | `http://127.0.0.1:8000/telemetry` | Active |
| Port 8001 | none | Not used |
| `/EA-MT5/` | none | Not an active route |
