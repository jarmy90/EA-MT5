@echo off
setlocal
cd /d "%~dp0"

title Mision Control - Arranque
color 0B

echo.
echo ================================================================
echo              MISION CONTROL - ARRANQUE LOCAL
echo ================================================================
echo.
echo [INFO] Se comprobara MT5 y se instalaran dependencias solo si faltan.
echo [INFO] La API se abrira en http://127.0.0.1:8000
echo.

python start_mision_control.py
if errorlevel 1 (
  echo.
  echo [ERROR] Mision Control no pudo iniciarse.
  echo [AYUDA] Abre MetaTrader 5 e inicia sesion, luego ejecuta este archivo otra vez.
  pause
  exit /b 1
)

pause
