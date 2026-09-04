@echo off
setlocal

echo Stopping only Quantora Orbit launcher windows...
taskkill /FI "WINDOWTITLE eq Quantora Orbit - MT5 Read-Only Bridge*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Quantora Orbit Web*" /T /F >nul 2>nul
echo [OK] Quantora Orbit launcher processes stopped, if they were running.
echo Other Python, Node, Bun, and MT5 processes were not targeted.
endlocal
