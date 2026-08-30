"""Launch Wawa from any directory: python start_mision_control.py"""
from __future__ import annotations

import importlib.util
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
PORT = int(os.getenv("PORT", "8000"))
URL = f"http://127.0.0.1:{PORT}"


def run(command: list[str], *, cwd: Path = ROOT, label: str) -> None:
    print(f"[INFO] {label}...")
    result = subprocess.run(command, cwd=cwd)
    if result.returncode != 0:
        raise SystemExit(f"[ERROR] {label} fallo con exit code {result.returncode}.")


def dependencies_ready() -> bool:
    return all(importlib.util.find_spec(name) for name in ("fastapi", "uvicorn", "dotenv"))


def install_dependencies() -> None:
    run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], label="Instalando dependencias Python")


def ensure_bun() -> str:
    bun = shutil.which("bun")
    if not bun:
        raise SystemExit("[ERROR] Bun no está instalado o no está en PATH. Instala Bun y vuelve a ejecutar este launcher.")
    return bun


def build_frontend(bun: str) -> None:
    run([bun, "install", "--frozen-lockfile"], label="Instalando dependencias frontend")
    run([bun, "run", "build"], label="Construyendo frontend Vite")
    if not (DIST / "index.html").is_file():
        raise SystemExit(f"[ERROR] El build terminó pero no existe {DIST / 'index.html'}.")


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) != 0


def ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            return response.status == 200
    except OSError:
        return False


def main() -> None:
    load_dotenv(ROOT / ".env", override=False)
    global PORT, URL
    PORT = int(os.getenv("PORT", "8000"))
    URL = f"http://127.0.0.1:{PORT}"
    print(f"[INFO] Raíz del proyecto: {ROOT}")
    if not dependencies_ready():
        install_dependencies()
    bun = ensure_bun()
    build_frontend(bun)
    if not port_available(PORT):
        raise SystemExit(f"[ERROR] El puerto {PORT} ya está ocupado. Cierra el proceso anterior y vuelve a intentarlo.")

    api = subprocess.Popen([sys.executable, "-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", str(PORT)], cwd=ROOT)
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT + 1), "--bind", "127.0.0.1"], cwd=DIST)
    try:
        for _ in range(30):
            if ready(URL):
                print(f"[OK] API disponible en {URL}")
                frontend_url = f"http://127.0.0.1:{PORT + 1}"
                print(f"[OK] Wawa disponible en {frontend_url}")
                webbrowser.open(frontend_url)
                print("[INFO] Navegador abierto. Pulsa Ctrl+C para detener API y frontend.")
                while True:
                    if api.poll() is not None:
                        raise SystemExit("[ERROR] La API terminó inesperadamente.")
                    if server.poll() is not None:
                        raise SystemExit("[ERROR] El servidor frontend terminó inesperadamente.")
                    time.sleep(1)
            time.sleep(1)
        raise SystemExit("[ERROR] El servidor no respondió dentro del tiempo esperado.")
    except KeyboardInterrupt:
        print("\n[INFO] Cerrando servicios...")
    finally:
        for process in (server, api):
            if process.poll() is None:
                process.terminate()
        for process in (server, api):
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    main()
