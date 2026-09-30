@echo off
setlocal
cd /d "%~dp0"

title Quantora Orbit - Start All
color 0B

echo.
echo ================================================================
echo                 QUANTORA ORBIT - START ALL
echo  Orbit web:       http://localhost:3000/
echo  MT5 health:      http://127.0.0.1:8000/health
echo ================================================================
echo.

where bun >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Bun no esta instalado o no esta en el PATH.
  echo         Instalalo con:  powershell -c "irm bun.sh/install.ps1 | iex"
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] Primera vez: instalando dependencias web (1-2 minutos)...
  call bun install
  if errorlevel 1 (
    echo [ERROR] Fallo bun install. Revisa tu conexion e intentalo de nuevo.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo [ERROR] Falta el archivo .env en esta carpeta.
  echo         Crea el .env con DATA_SOURCE=bridge y tus BOT_x_MAGIC.
  pause
  exit /b 1
)

start "Quantora Orbit - MT5 Read-Only Bridge" /D "%~dp0" cmd /k "start_mision_control.bat"
timeout /t 2 /nobreak >nul
start "Quantora Orbit Web" /D "%~dp0" cmd /k "bun run dev"
timeout /t 6 /nobreak >nul
start "" "http://localhost:3000/"

echo [OK] Puente iniciado en 127.0.0.1:8000.
echo [OK] Web iniciada en localhost:3000.
echo [INFO] Deja las dos ventanas abiertas. Usa STOP_ALL.bat para cerrarlas.
endlocal
