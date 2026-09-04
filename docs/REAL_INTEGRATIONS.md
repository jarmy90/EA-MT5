# Real integrations

## Quantora Orbit

The root application is Quantora Orbit, a Next.js 15 + React 19 dashboard served by `server.ts` on port `3000`. Its browser transport is the validated WebSocket endpoint `/ws`. Mock telemetry is deterministic and is labelled `SIMULACIÓN`.

## MetaTrader 5

MT5 remains available through the local FastAPI bridge in `api/` and `mt5_bridge/`. The bridge runs on the same Windows machine as the open MT5 desktop terminal:

```text
MT5 terminal -> MetaTrader5 Python package -> FastAPI at 127.0.0.1:8000
```

Only the bridge API should be exposed through a secure HTTPS tunnel. The cloud server polls `/telemetry` server-side and forwards normalized data to the dashboard browser over `/ws`. The browser never connects to MT5 directly.

The bridge requires a Bearer token when `BRIDGE_TOKEN` or the compatibility variable `MT5_BRIDGE_TOKEN` is configured. It attempts the existing terminal session first when login/password variables are empty. The bridge is read-only and does not expose order execution.

## Secrets and truthfulness

Secrets must remain in local environment configuration or the platform secret manager. Never commit MT5 credentials, bridge tokens, tunnel URLs containing secrets, or tokens prefixed with `NEXT_PUBLIC_`. The UI must show `MT5 LIVE` only after an authenticated, fresh bridge response; otherwise it must show `MT5 OFFLINE`, `RECONECTANDO`, or `SIMULACIÓN`.

## Historical files

The former Vite/WAWA dashboard and its launchers are archived under `legacy/autonomous-business-lab/`. They are not the active integration and must not be started. Port `8001` and `/EA-MT5/` are not used by Quantora Orbit.
