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
  echo Install Bun, then run this launcher again.
  pause
  exit /b 1
)

start "Quantora Orbit Web" /D "%~dp0" cmd /k "bun run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000/"

echo [OK] Orbit launched on http://localhost:3000/
echo [INFO] Keep the Orbit window open while using the dashboard.
endlocal
