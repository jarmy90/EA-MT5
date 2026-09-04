# Quantora Orbit Master Record

**Updated:** 2026-09-04T07:11:07Z
**Project:** Quantora Orbit (`jarmy90/EA-MT5`)
**Workspace root:** `/home/daytona/codebase`
**Branch:** `main`
**Remote:** `https://github.com/jarmy90/EA-MT5.git`

## Architecture

The active application is Next.js 15.5.2 with React 19, TypeScript, Three.js, React Three Fiber, Drei, Rapier, postprocessing, Zod, and a persistent Node server. `app/` contains the App Router entrypoint; `components/` contains the HUD, WebSocket provider, scene, and shader entity; `lib/schema.ts` defines the normalized telemetry contract; `server.ts` serves Next.js and `/ws`; `server/mock.ts` provides deterministic simulation telemetry.

The MT5 boundary is a separate read-only Python FastAPI adapter. It reads the already-open MetaTrader 5 desktop terminal through the official `MetaTrader5` package, exposes `/health` and `/telemetry`, and never exposes an order execution endpoint. The cloud server polls the adapter over `MT5_BRIDGE_HTTP_URL`, validates/normalizes the payload, and forwards it to the browser over its own WebSocket.

## Security boundary

- MT5 login and password are environment-only and are not stored in source, documentation values, Git history, or published artifacts.
- `BRIDGE_TOKEN` is the preferred shared bearer-token variable. `MT5_BRIDGE_TOKEN` remains supported for compatibility.
- The bridge requires `Authorization: Bearer <token>` on `/health` and `/telemetry` whenever a token is configured.
- The browser does not receive MT5 credentials or the bridge token.
- The tunnel should expose only `http://127.0.0.1:8000`; the MT5 terminal and router ports remain private.
- The adapter is read-only: only `account_info`, `terminal_info`, `positions_get`, `symbol_info_tick`, and `copy_rates_from_pos` are used.

## Verification record

- `bun install --frozen-lockfile`: PASS.
- `bun tsc -b --noEmit`: PASS.
- `bun run lint`: PASS using the noninteractive ESLint 9 configuration.
- `bun run build`: PASS; Next.js production build generated successfully.
- `python3 -m py_compile start_mision_control.py api/main.py mt5_bridge/service.py`: PASS.
- Managed preview: PASS; ready on port 3000 and returned HTTP 200.
- Managed preview WebSocket: PASS; returned valid simulation telemetry with 4 bots and initial balance 1350.
- Bridge auth test with disposable token: PASS; no token 401, wrong token 401, correct token `/health` 200, correct token `/telemetry` 200.
- Trading-operation scan: PASS; no order-send, order-check, modify, close, or cancel call exists in the bridge code.
- Real MT5 `/health` and live telemetry: NOT RUN in cloud; the Windows-only `MetaTrader5` package requires the user's laptop and active MT5 terminal.
- Full `python3 -m pip install -r requirements.txt`: BLOCKED in Linux cloud because the official `MetaTrader5` wheel is Windows-only. Run it on Windows.

## Laptop connection flow

1. Clone or extract the repository.
2. In PowerShell, enter the repository folder.
3. Confirm Python 3.10+ and Node.js 20+.
4. Create and activate `.venv`.
5. Install `requirements.txt` inside `.venv`.
6. Create a local `.env` containing `BRIDGE_TOKEN`, `MT5_SERVER`, `MT5_SYMBOLS`, and optionally MT5 login values. Prefer the existing open MT5 session and leave login/password empty unless needed.
7. Generate the token locally with PowerShell; never paste it into chat.
8. Keep MT5 open and logged in.
9. Run `start_mision_control.bat`.
10. Test local `/health`, then test 401 without a token and 200 with the token.
11. Install `cloudflared` with `winget`.
12. Run a named Cloudflare Tunnel or a temporary `trycloudflare.com` tunnel to `http://127.0.0.1:8000`.
13. Copy only the HTTPS hostname printed by `cloudflared`, without `/health` or `/telemetry`.
14. Store that URL privately as the server-side `MT5_BRIDGE_HTTP_URL` value in the dashboard environment.
15. Store the same local token as the dashboard server-side `BRIDGE_TOKEN` value.
16. Restart the dashboard server and verify the browser shows `MT5 LIVE`, not `SIMULACIÓN`.
17. Identify EAs using `AGENT_MAP` with their magic numbers or comments; never guess attribution for live trading decisions.

## Pending limitations

- No real laptop MT5 session or Cloudflare tunnel is connected from this cloud workspace.
- The cloud preview remains in deterministic mock mode until the dashboard server receives a reachable HTTPS bridge URL and matching bearer token.
- The current adapter's default four EA names and magic numbers are documented in `api/main.py`; set `AGENT_MAP` for exact account-specific attribution.
- Do not enable trade execution: the delivered bridge has no trade execution path.
