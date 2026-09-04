@echo off
setlocal
cd /d "%~dp0"
title Quantora Orbit - Web Dashboard
color 0B

echo.
echo ================================================================
echo                 QUANTORA ORBIT - WEB
echo ================================================================
echo  Dashboard:  http://localhost:3000/
echo  WebSocket:  ws://localhost:3000/ws
echo  MT5 API:    http://127.0.0.1:8000/health
echo  This launcher starts only the Orbit web dashboard.
echo ================================================================
echo.

where bun >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Bun is not installed or not in PATH.
  pause
  exit /b 1
)

start "Quantora Orbit Web" /D "%~dp0" cmd /k "bun run dev"
set "READY="
for /L %%N in (1,1,30) do (
  powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { exit 0 } else { exit 1 }" >nul 2>nul
  if not errorlevel 1 set "READY=1" & goto :ready
  timeout /t 1 /nobreak >nul
)

if not defined READY (
  echo [ERROR] Orbit did not open port 3000 within 30 seconds.
  exit /b 1
)

:ready
start "" "http://localhost:3000/"
echo [OK] Orbit is listening on http://localhost:3000/
echo [INFO] Keep the Orbit window open while using the dashboard.
endlocal
