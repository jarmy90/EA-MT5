@echo off
setlocal
cd /d "%~dp0"

title Quantora Orbit - MT5 Read-Only Bridge
color 0B

echo.
echo ================================================================
echo              QUANTORA ORBIT - MT5 BRIDGE ONLY
echo ================================================================
echo  Private health:    http://127.0.0.1:8000/health
echo  Private telemetry: http://127.0.0.1:8000/telemetry
echo.
echo  This is NOT the web dashboard.
echo  The dashboard runs separately on http://localhost:3000/
echo  Port 8001 and /EA-MT5/ are not used.
echo ================================================================
echo  Keep this window open while MT5 telemetry is needed.
echo  Close this window or press Ctrl+C to stop the bridge.
echo ================================================================
echo.

set "PYTHON=python"
if exist "%~dp0.venv\Scripts\python.exe" set "PYTHON=%~dp0.venv\Scripts\python.exe"

"%PYTHON%" start_mision_control.py

pause
endlocal
