# Quantora Orbit — Windows Quick Start

This repository has one active web application: **Quantora Orbit**.

- Web dashboard: `http://localhost:3000/`
- Browser WebSocket: `ws://localhost:3000/ws`
- Private MT5 bridge API: `http://127.0.0.1:8000/health`
- Private MT5 telemetry API: `http://127.0.0.1:8000/telemetry`
- Port `8001` is not used by the active application.
- `http://127.0.0.1:8001/EA-MT5/` is an old route and is not the correct web address.

## One-click start

1. Open MetaTrader 5 and leave the account connected.
2. Open the repository folder.
3. Double-click `START_ALL.bat`.
4. Wait for both console windows to start.
5. Open `http://localhost:3000/`.

`START_ALL.bat` starts only:

- the read-only MT5 bridge on `127.0.0.1:8000`;
- the Quantora Orbit dashboard on `localhost:3000`.

It does not start the archived WAWA/Autonomous Business Lab application and does not use port `8001`.

## First setup

Open PowerShell in the repository folder. Type only the commands, not the prompt text such as `PS C:\Users\j>`.

```powershell
py --version
node --version
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create `.env` locally. Do not commit it and do not paste its contents into chat:

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

Generate and save a private token without displaying it:

```powershell
$bytes=New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); $env:BRIDGE_TOKEN=[Convert]::ToBase64String($bytes); Add-Content .env ("BRIDGE_TOKEN=" + $env:BRIDGE_TOKEN); Remove-Variable bytes
```

The empty MT5 login and password make the bridge use the session already open in the desktop terminal.

## Check the bridge

After `START_ALL.bat` is running, test without a token. It must return `401`:

```powershell
try { (Invoke-WebRequest http://127.0.0.1:8000/health -ErrorAction Stop).StatusCode } catch { [int]$_.Exception.Response.StatusCode }
```

Load the token without printing it and test again. It must return `200`:

```powershell
$env:BRIDGE_TOKEN=(Get-Content .env | Where-Object { $_ -match "^BRIDGE_TOKEN=" } | Select-Object -First 1).Substring(13)
$headers=@{Authorization="Bearer $env:BRIDGE_TOKEN"}
(Invoke-WebRequest http://127.0.0.1:8000/health -Headers $headers).StatusCode
```

Read the sanitized telemetry:

```powershell
$data=Invoke-RestMethod http://127.0.0.1:8000/telemetry -Headers $headers
$data.status
$data.account
$data.positions | Select-Object symbol,magic,type,volume,profit | Format-Table
```

`connected : True` means the bridge has a fresh connection to the open MT5 terminal. The dashboard must show `MT5 LIVE` only after this real authenticated telemetry path is working. Otherwise it honestly shows `MT5 OFFLINE`, `RECONECTANDO`, or `SIMULACIÓN`.

## Public web access

The public dashboard requires two separate things:

1. A public deployment of the Quantora Orbit web server.
2. A secure HTTPS tunnel from the Windows laptop to the private bridge on port `8000`.

Install Cloudflare Tunnel:

```powershell
winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
```

Create the temporary HTTPS tunnel:

```powershell
cloudflared tunnel --url http://127.0.0.1:8000
```

Copy only the address that looks like:

```text
https://random-name.trycloudflare.com
```

Do not copy `/health`, `/telemetry`, `127.0.0.1`, the token, or the full log line.

In the private environment settings of the public Quantora Orbit server, configure:

```text
DATA_SOURCE=bridge
MT5_BRIDGE_HTTP_URL=https://random-name.trycloudflare.com
BRIDGE_TOKEN=<the same private token used by the Windows bridge>
```

Never put the token or MT5 credentials in frontend code, Git, a URL, or chat. Restart the public dashboard after changing the server environment. Keep both the bridge and `cloudflared` console windows open.

The public dashboard path is the deployed root `/`, not `/EA-MT5/`.

## Identify the four EAs

Use the position output above. The `magic` and `comment` values identify the EA that owns each open position. Configure `AGENT_MAP` only with the real values from your account; do not guess. The default visual names are:

- `NQ-ALPHA`
- `NQ-SIGMA`
- `XAU-PRIME`
- `XAU-FLASH`

## Stop safely

Double-click `STOP_ALL.bat`. It targets only the launcher windows named `Quantora Orbit`; it does not target unrelated Python, Node, Bun, or MT5 processes.

## Separate old files

The former Vite/WAWA dashboard is preserved under `legacy/autonomous-business-lab/` for traceability only. Do not run its old launchers. The root `start_mision_control.bat` is only the MT5 bridge; `START_ORBIT.bat` is only the web dashboard; `START_ALL.bat` starts both.
