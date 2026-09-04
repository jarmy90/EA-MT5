@echo off
setlocal
cd /d "%~dp0"

title Quantora Orbit - Start All
color 0B

echo.
echo ================================================================
echo                 QUANTORA ORBIT - START ALL
echo ================================================================
echo  Orbit web:       http://localhost:3000/
echo  Orbit WebSocket: ws://localhost:3000/ws
echo  MT5 health:      http://127.0.0.1:8000/health
echo  MT5 telemetry:   http://127.0.0.1:8000/telemetry
echo.
echo  Starting the read-only MT5 bridge and Orbit web only.
echo  No legacy WAWA application is started.
echo ================================================================
echo.

start "Quantora Orbit - MT5 Read-Only Bridge" /D "%~dp0" cmd /k "start_mision_control.bat"
timeout /t 2 /nobreak >nul
start "Quantora Orbit Web" /D "%~dp0" cmd /k "bun run dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:3000/"

echo [OK] Bridge window started on 127.0.0.1:8000.
echo [OK] Orbit window started on localhost:3000.
echo [INFO] Keep both windows open. Use STOP_ALL.bat to stop these launchers.
endlocal
