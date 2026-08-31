@echo off
title WAWA - Iniciar dashboard (deja esta ventana abierta)
cd /d "%~dp0"
echo ============================================
echo   WAWA - activando bridge MT5 y tunel publico
echo   Deja esta ventana abierta.
echo   Para detener pulsa Ctrl+C.
echo ============================================
python start_wawa_mobile.py
echo.
echo El proceso termino. Revisa el mensaje anterior.
pause