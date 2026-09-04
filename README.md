# Quantora Orbit

Quantora Orbit is the **only active web application** in this repository. It is a cinematic real-time dashboard for four MetaTrader 5 Expert Advisors, built with Next.js 15, React 19, TypeScript, Three.js and React Three Fiber.

## Correct addresses

| Purpose | Address | Meaning |
| --- | --- | --- |
| Quantora Orbit web | `http://localhost:3000/` | Active dashboard |
| Quantora Orbit WebSocket | `ws://localhost:3000/ws` | Browser telemetry transport |
| MT5 bridge health | `http://127.0.0.1:8000/health` | Private read-only API |
| MT5 bridge telemetry | `http://127.0.0.1:8000/telemetry` | Private read-only API |
| Port 8001 | none | Not used |
| `/EA-MT5/` | none | Not an active route |

**Do not open `http://127.0.0.1:8001/EA-MT5/`.** That address belonged to an old Python/Vite dashboard and is not Quantora Orbit.

## Active application

The root web application is:

```text
app/layout.tsx
app/page.tsx
app/globals.css
components/
lib/
server.ts
server/mock.ts
package.json
bun.lock
```

It starts on port `3000`, binds to `0.0.0.0` for managed hosting, and keeps deterministic simulation clearly labelled `SIMULACIÓN`. The four 3D sphere entities are rendered by `components/Scene.tsx` and `components/SphereBot.tsx`.

## Quick local start on Windows

1. Open MetaTrader 5 and leave its account connected.
2. Complete the first-time setup below.
3. Double-click `START_ALL.bat`.
4. Wait for the two console windows.
5. Open `http://localhost:3000/`.

The launchers are explicit:

- `start_mision_control.bat` starts only the read-only MT5 bridge on `127.0.0.1:8000`.
- `START_ORBIT.bat` starts only Quantora Orbit on `localhost:3000`.
- `START_ALL.bat` starts both and opens only `http://localhost:3000/`.
- `STOP_ALL.bat` targets only the Quantora Orbit launcher windows.

## First-time bridge setup

Open PowerShell in the repository folder. Type only the commands, not the prompt text such as `PS C:\Users\j>`.

```powershell
py --version
node --version
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create `.env` locally. Do not commit it or send its contents anywhere:

```powershell
@(
  "DATA_SOURCE=bridge"
  "MT5_SERVER=ICMarketsEU-MT5-5"
  "MT5_SYMBOLS=USTEC,XAUUSD"
  "BRIDGE_HOST=127.0.0.1"
  "BRIDGE_PORT=8000"
  "MT5_LOGIN="
  "MT5_PASSWORD="
) | Set-Content .env
```

Generate a private Bearer token without printing it:

```powershell
$bytes=New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); $env:BRIDGE_TOKEN=[Convert]::ToBase64String($bytes); Add-Content .env ("BRIDGE_TOKEN=" + $env:BRIDGE_TOKEN); Remove-Variable bytes
```

Empty MT5 login/password values make the bridge use the session already open in the desktop terminal. The bridge does not send orders.

## Verify the local bridge

Without a token, `/health` must return `401`:

```powershell
try { (Invoke-WebRequest http://127.0.0.1:8000/health -ErrorAction Stop).StatusCode } catch { [int]$_.Exception.Response.StatusCode }
```

Load the token privately and test authenticated health:

```powershell
$env:BRIDGE_TOKEN=(Get-Content .env | Where-Object { $_ -match "^BRIDGE_TOKEN=" } | Select-Object -First 1).Substring(13)
$headers=@{Authorization="Bearer $env:BRIDGE_TOKEN"}
(Invoke-WebRequest http://127.0.0.1:8000/health -Headers $headers).StatusCode
```

The authenticated response must be `200`. Then inspect sanitized telemetry:

```powershell
$data=Invoke-RestMethod http://127.0.0.1:8000/telemetry -Headers $headers
$data.status
$data.account
$data.positions | Select-Object symbol,magic,type,volume,profit | Format-Table
```

Only after a fresh authenticated bridge response should the dashboard display `MT5 LIVE`. Otherwise it must honestly show `MT5 OFFLINE`, `RECONECTANDO`, or `SIMULACIÓN`.

## Public web connection

A public dashboard needs a public deployment of the Next.js server. Separately, the Windows bridge needs a secure HTTPS tunnel. Do not expose MT5 itself or router ports.

Install Cloudflare Tunnel:

```powershell
winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
```

Run the temporary tunnel while the bridge is running:

```powershell
cloudflared tunnel --url http://127.0.0.1:8000
```

Copy only the HTTPS hostname printed by Cloudflared, such as `https://random-name.trycloudflare.com`. Configure these values privately in the server environment of the public Quantora Orbit deployment:

```text
DATA_SOURCE=bridge
MT5_BRIDGE_HTTP_URL=https://random-name.trycloudflare.com
BRIDGE_TOKEN=<same private token as the Windows bridge>
```

Restart the public dashboard. Open its root `/` URL, never `/EA-MT5/`. Keep the bridge and tunnel windows open. A temporary tunnel URL changes after restart; use a named tunnel for a durable public URL.

## Production configuration

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run build
bun run start
```

The managed hosting configuration uses `bun install` and `bun run build`. The custom server reads the platform `PORT` and supports WebSocket upgrades.

## Legacy material

The former Vite/WAWA/Autonomous Business Lab files are preserved under `legacy/autonomous-business-lab/` for traceability only. They are not active, are not referenced by the root package scripts, and must not be started. Historical WAWA contract documents remain as documentation records, not runtime entrypoints.

## Security and read-only boundary

- Keep `.env`, `.env.local`, bridge tokens and MT5 credentials out of Git.
- Never use `NEXT_PUBLIC_` for secrets.
- The bridge reads account, terminal, positions, ticks and rates only.
- No order creation, modification, closure or cancellation endpoint exists.
- The browser receives normalized telemetry, never MT5 credentials or the bridge token.
- Rotate any credential previously exposed in chat, screenshots or logs.

## Files

- `app/`, `components/`, `lib/`, `server.ts` — active Quantora Orbit application.
- `api/`, `mt5_bridge/` — isolated read-only Python MT5 bridge.
- `start_mision_control.bat` — bridge only.
- `START_ORBIT.bat` — web only.
- `START_ALL.bat` — bridge plus web.
- `STOP_ALL.bat` — launcher cleanup.
- `WINDOWS_QUICK_START.md` — short Windows guide.
- `legacy/autonomous-business-lab/` — archived former app.
