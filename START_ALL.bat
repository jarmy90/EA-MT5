@echo off
setlocal
cd /d "%~dp0"

title Quantora Orbit - Start All
color 0B

echo.
echo ================================================================
echo                 QUANTORA ORBIT - START ALL
echo  Web:   http://localhost:3000/
echo  Puente MT5: http://127.0.0.1:8000
echo ================================================================
echo.

where bun >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Bun no esta instalado o no esta en el PATH.
  echo.
  echo Instalalo con este comando, cierra esta ventana y vuelve a empezar:
  echo    powershell -c "irm bun.sh/install.ps1 | iex"
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [ERROR] Falta el archivo .env en esta carpeta.
  echo         Debe contener al menos: DATA_SOURCE=bridge
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] Instalando dependencias web, solo la primera vez (1-2 min)...
  call bun install
  if errorlevel 1 (
    echo [ERROR] Fallo bun install. Revisa conexion y vuelve a ejecutar.
    pause
    exit /b 1
  )
)

echo [INFO] Sincronizando dependencias...
call bun install --frozen-lockfile >nul 2>nul

echo [INFO] Abriendo el puente MT5 en una ventana aparte...
start "Quantora Orbit - MT5 Bridge" /D "%~dp0" cmd /k "start_mision_control.bat"
timeout /t 2 /nobreak >nul

echo [INFO] Abriendo la web en una ventana aparte...
start "Quantora Orbit Web" /D "%~dp0" cmd /k "bun run dev"

echo [INFO] Esperando a que la web responda (maximo 45s)...
set "READY="
for /L %%N in (1,1,45) do (
  if not defined READY (
    powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { exit 0 } else { exit 1 }" >nul 2>nul
    if not errorlevel 1 set "READY=1"
    if not defined READY timeout /t 1 /nobreak >nul
  )
)

if not defined READY (
  echo.
  echo [ERROR] La web no abrio el puerto 3000 en 45 segundos.
  echo         La ventana "Quantora Orbit Web" contiene el motivo exacto.
  echo         Copia su contenido y envialo para el arreglo concreto.
  echo.
  echo Esta ventana se queda abierta para que puedas leerlo.
  pause
  exit /b 1
)

start "" "http://localhost:3000/"
echo [OK] Web lista en http://localhost:3000/
echo [OK] Deja abiertas las dos ventanas negras y esta.
endlocal
