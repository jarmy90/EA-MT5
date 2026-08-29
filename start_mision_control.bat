@echo off
setlocal
cd /d "%~dp0"

title Mision Control - AI Command Station
color 0B

echo.
echo ================================================================
echo              MISION CONTROL - AI COMMAND STATION
echo ================================================================
echo.
echo  [1/3] Instalando dependencias...
pip install -q -r requirements.txt 2>nul
echo  [OK] Dependencias listas.
echo.
echo  [2/3] Arrancando API en http://127.0.0.1:8000 ...
echo.
echo  [3/3] Abre tu navegador en: http://127.0.0.1:8000
echo.
echo ================================================================
echo  Cierra esta ventana para detener la API.
echo ================================================================
echo.

python -m uvicorn api.main:app --host 127.0.0.1 --port 8000

pause
