@echo off
setlocal
cd /d "%~dp0"

title Quantora Orbit - MT5 Read-Only Bridge
color 0B

echo.
echo ================================================================
echo              QUANTORA ORBIT - MT5 BRIDGE
echo ================================================================
echo.
echo  Starting the read-only MT5 bridge on http://127.0.0.1:8000 ...
echo  Keep this window open while the cloud dashboard is connected.
echo.
echo ================================================================
echo  Close this window or press Ctrl+C to stop the bridge.
echo ================================================================
echo.

python start_mision_control.py

pause
