@echo off
title Quantora Orbit - Stop
echo Cerrando Quantora Orbit (web y puente)...

powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'tsx server\.ts' -or $_.CommandLine -match 'start_mision_control' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo [OK] Procesos de Quantora Orbit detenidos.
timeout /t 2 /nobreak >nul
