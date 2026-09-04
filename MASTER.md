# Quantora Orbit Master Record

**Updated:** 2026-09-04T08:11:31Z
**Project:** Quantora Orbit (`jarmy90/EA-MT5`)
**Workspace root:** `/home/daytona/codebase`
**Branch:** `main`
**Remote:** `https://github.com/jarmy90/EA-MT5.git`

## Root-cause resolution

The confusion came from two different applications being present in the same repository. The former Vite/WAWA/Autonomous Business Lab app had a root `index.html`, `vite.config.ts` with `base: '/EA-MT5/'`, and `src/` files. Running that app or opening the old `8001/EA-MT5/` route showed the old interface. Quantora Orbit itself was already the Next.js application served by `server.ts` on port `3000`.

The obsolete Vite entrypoint and old WAWA launcher artifacts were moved, not deleted, to `legacy/autonomous-business-lab/`. The root now has one active web entrypoint: Next.js `app/page.tsx` served by `server.ts`. No root script starts the legacy app.

## Active architecture

Quantora Orbit is Next.js 15.5.2 with React 19, TypeScript, Three.js, React Three Fiber, Drei, Rapier, postprocessing, Zod, and a persistent Node server. The active files are `app/`, `components/`, `lib/`, `server.ts`, `server/mock.ts`, `package.json`, and `bun.lock`. `components/Scene.tsx` and `components/SphereBot.tsx` render the four animated 3D sphere entities.

The MT5 boundary is separate and read-only:

```text
MetaTrader 5 desktop on Windows
  -> official Python MetaTrader5 package
  -> api/main.py FastAPI bridge at 127.0.0.1:8000
  -> authenticated HTTPS tunnel exposing only the bridge
  -> server.ts polls MT5_BRIDGE_HTTP_URL server-side
  -> browser WebSocket /ws on port 3000
  -> Quantora Orbit HUD and four spheres
```

The browser never connects directly to MT5 and never receives MT5 credentials or `BRIDGE_TOKEN`.

## Final ports and routes

| Purpose | Address | Status |
| --- | --- | --- |
| Quantora Orbit web | `http://localhost:3000/` | Active |
| Quantora Orbit WebSocket | `ws://localhost:3000/ws` | Active |
| Private MT5 bridge health | `http://127.0.0.1:8000/health` | Active |
| Private MT5 bridge telemetry | `http://127.0.0.1:8000/telemetry` | Active |
| Port 8001 | none | Not used |
| `/EA-MT5/` | none | Not an active route |

The server sends `Cache-Control: no-store, max-age=0` and `Pragma: no-cache` so cache does not obscure the active runtime. The root route is `/`, not `/EA-MT5/`.

## Windows launchers

- `start_mision_control.bat`: starts only the read-only FastAPI MT5 bridge on `127.0.0.1:8000`.
- `START_ORBIT.bat`: starts only the root Quantora Orbit server on port `3000` and opens `http://localhost:3000/`.
- `START_ALL.bat`: starts the bridge and Orbit, prints all four active addresses, and opens only the Orbit root.
- `STOP_ALL.bat`: targets the launcher windows named Quantora Orbit and avoids generic Python, Node, Bun, or MT5 process termination.
- `WINDOWS_QUICK_START.md`: one-step Windows setup and Cloudflare Tunnel instructions.

The bridge launcher prefers `.venv\Scripts\python.exe` when available. It does not open any old dashboard.

## Legacy isolation

Moved to `legacy/autonomous-business-lab/`:

- `index.html`
- `vite.config.ts`
- `src/`
- `static/`
- `start_wawa_mobile.py`
- `iniciar_wawa.cmd`
- `WAWA_WINDOWS_INSTALLER.zip`
- `mt5-bots-dashboard.zip`
- `quantora-orbit.zip`

`api/`, `mt5_bridge/`, `requirements.txt`, `api/agents.py`, `start_mision_control.py`, and the root bridge launcher were preserved as the current MT5 integration. No source files were deleted; the old application is archived and explicitly marked inactive.

Historical WAWA contract and notice documents remain as documentation records only. Their references to WAWA, Vite, GitHub Pages, or the former contract are not active runtime wiring.

## Security and read-only boundary

- `BRIDGE_TOKEN` is the preferred shared Bearer token; `MT5_BRIDGE_TOKEN` remains compatible.
- `/health` and `/telemetry` require authentication whenever a token is configured.
- MT5 login and password remain environment-only and were not written to source, docs, reports, ZIP output, or Git.
- The bridge uses only read operations: `account_info`, `terminal_info`, `positions_get`, `symbol_info_tick`, `copy_rates_from_pos`, and connection lifecycle calls.
- No order send, order check, order modify, order close, cancel, or position mutation call exists in `api/` or `mt5_bridge/`.
- Real MT5 LIVE status is not claimed by cloud tests; it requires the user's Windows terminal and bridge.

## Verification record

- `bun install --frozen-lockfile`: PASS.
- `bun run typecheck`: PASS.
- `bun run lint`: PASS.
- `bun run build`: PASS; Next.js production build generated successfully.
- `python3 -m py_compile start_mision_control.py api/main.py api/agents.py mt5_bridge/service.py tools/list_magics.py tools/test_agents.py`: PASS.
- In-process bridge auth with disposable token: no token `401`, wrong token `401`, correct `/health` `200`, correct `/telemetry` `200`.
- Read-only operation scan: PASS; no trade execution symbols found.
- Root old entrypoint count: `0`.
- Root old WAWA launcher count: `0`.
- Port `8001`: NOT LISTENING in the cloud workspace.
- Managed preview restart: PASS; ready on port `3000`.
- Served root: HTTP `200`, contains `QUANTORA`; does not contain `Autonomous Business Lab`.
- Managed preview WebSocket: PASS; schema-valid telemetry, 4 bots, source `mock`.
- `python3 -m pytest -q tools/test_agents.py`: unavailable because `pytest` is not installed in the workspace; Python syntax and bridge auth checks pass.
- Real Windows `MetaTrader5` connection: NOT RUN in Linux cloud; verify on the laptop with MT5 open.

## Current delivery

Structural delivery commit: `927274c084450c95ce9b51c1bf5f92f8d0b3a7e0` (`Make Quantora Orbit the sole root web app`). The remote `origin/main` matches this commit before this record-only update.

The managed preview URL is:

`https://3000-77989083-26a3-4856-867e-785ebe850fd8.daytonaproxy01.net/`

The deployment configuration is valid with install command `bun install` and build command `bun run build`. A production deployment URL does not exist until the first deployment is started from the hosting Deploy control.

## Pending limitations

- The cloud workspace cannot verify the Windows-only `MetaTrader5` package or the user's active terminal.
- The user must run the bridge and Cloudflare Tunnel on Windows and configure `DATA_SOURCE=bridge`, `MT5_BRIDGE_HTTP_URL`, and `BRIDGE_TOKEN` privately on the public dashboard server.
- A temporary `trycloudflare.com` URL changes when the tunnel restarts; use a named tunnel for a durable public URL.
- Exact EA attribution requires the real MT5 magic numbers or comments in `AGENT_MAP`.
- The bridge remains intentionally read-only.
- Production deployment URL: none yet; hosting check is deployable, but first deployment requires the hosting Deploy control.
- Delivery ZIP: `mt5-living-bots-dashboard.zip.txt`, generated from the final tracked tree after the record update and validated with `unzip -t`.
