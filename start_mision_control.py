"""Arranque de Misión Control: python start_mision_control.py"""
from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"
URL = "http://127.0.0.1:" + os.getenv("PORT", "8000")


def dependencies_ready() -> bool:
    return all(importlib.util.find_spec(name) for name in ("fastapi", "uvicorn", "MetaTrader5", "dotenv"))


def install_dependencies() -> None:
    print("[INFO] Instalando dependencias necesarias...")
    result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], cwd=ROOT)
    if result.returncode:
        raise SystemExit("[ERROR] No se pudieron instalar las dependencias. Revisa Python y vuelve a intentarlo.")


def api_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url + "/status", timeout=1) as response:
            return response.status == 200
    except (OSError, ValueError):
        return False


if __name__ == "__main__":
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE, override=False)
    else:
        print("[AVISO] No existe .env; se usará la sesión ya iniciada en MetaTrader 5.")

    if not dependencies_ready():
        install_dependencies()

    port = os.getenv("PORT", "8000")
    URL = f"http://127.0.0.1:{port}"
    print("[INFO] Comprobando MetaTrader 5...")
    try:
        import MetaTrader5 as mt5
        initialized = mt5.initialize()
        logged_in = initialized and bool(mt5.terminal_info() and mt5.account_info())
        if not logged_in:
            if initialized:
                mt5.shutdown()
            print("[ERROR] Abre MetaTrader 5 e inicia sesión, luego vuelve a ejecutar este script.")
            raise SystemExit(1)
        print("[OK] MetaTrader 5 está abierto y conectado.")
        mt5.shutdown()
    except ImportError:
        raise SystemExit("[ERROR] MetaTrader5 no está instalado. Ejecuta el launcher de nuevo.")

    print(f"[INFO] Levantando API en {URL}...")
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", port],
        cwd=ROOT,
    )
    for _ in range(30):
        if api_ready(URL):
            print(f"[OK] Misión Control disponible en {URL}")
            webbrowser.open(URL)
            print("[INFO] Navegador abierto. Esta ventana mantiene la API activa.")
            try:
                process.wait()
            except KeyboardInterrupt:
                process.terminate()
            break
        time.sleep(1)
    else:
        process.terminate()
        raise SystemExit("[ERROR] La API no respondió a tiempo. Revisa los mensajes anteriores.")
