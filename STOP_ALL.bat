@echo off
title Quantora Orbit - Stop
echo Cerrando Quantora Orbit (web, puente y puertos)...

powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'server\.ts' -or $_.CommandLine -match 'start_mision_control' -or $_.CommandLine -match 'uvicorn api\.main' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; foreach ($p in 3000,8000) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"

echo [OK] Quantora Orbit detenido y puertos 3000/8000 liberados.
timeout /t 2 /nobreak >nul
