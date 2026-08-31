"""Iniciar WAWA — deja el dashboard LIVE accesible desde cualquier navegador.

Diseñado para ejecutarse en el mismo Windows donde está instalado y logueado
MetaTrader5 (el terminal de MT5 solo lee el terminal de esa misma máquina).

Hace, en orden:
  1. Instala dependencias Python si faltan (requirements.txt).
  2. Arranca el bridge read-only de MT5 en http://127.0.0.1:8000.
  3. Descarga cloudflared (una sola vez) si no está instalado.
  4. Abre un túnel HTTPS público y captura la URL https://xxxx.trycloudflare.com.
  5. Imprime las direcciones para TÚ.
  6. Se queda esperando (Ctrl+C detiene túnel + bridge).

El frontend resuelve el bridge en tiempo de ejecución: si abres directamente la
URL del túnel conecta LIVE al instante, y en la página web fija usas
  <URL_FIJA>?bridge=<URL_DEL_TUNEL>
una sola vez (queda guardada en el dispositivo y las siguientes visitas conectan solas).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "8000"))
CLOUDFLARED_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
TUNNEL_URL_RE = re.compile(r"https://[a-z0-9\-]+\.trycloudflare\.com")
# Si lo tienes desplegado, pon aquí la dirección fija (opcional):
DASHBOARD_URL = (os.getenv("DASHBOARD_URL") or "").rstrip("/")

pink = "\033[95m"; cyan = "\033[96m"; green = "\033[92m"; yellow = "\033[93m"; bold = "\033[1m"; reset = "\033[0m"


def log(msg: str, color: str = "") -> None:
    print(f"{color}{msg}{reset}", flush=True)


def ensure_python_deps() -> None:
    log("\n[1/3] Verificando dependencias Python...", cyan)
    req = ROOT / "requirements.txt"
    if req.exists():
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(req)], check=False)
    log("  OK", green)


def start_bridge() -> subprocess.Popen:
    log(f"[2/3] Arrancando bridge MT5 (solo lectura) en http://127.0.0.1:{BRIDGE_PORT}...", cyan)
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", str(BRIDGE_PORT)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def cloudflared_binary() -> Path:
    exe = shutil.which("cloudflared") or shutil.which("cloudflared.exe")
    if exe:
        return Path(exe)
    dest_dir = Path(os.getenv("LOCALAPPDATA", Path.home())) / "cloudflared"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "cloudflared.exe"
    if dest.exists():
        return dest
    log("  Descargando cloudflared (una sola vez)...", yellow)
    urllib.request.urlretrieve(CLOUDFLARED_URL, dest)
    return dest


def start_tunnel() -> tuple[subprocess.Popen, str]:
    log("[3/3] Abriendo túnel HTTPS público con cloudflared...", cyan)
    proc = subprocess.Popen(
        [str(cloudflared_binary()), "tunnel", "--url", f"http://127.0.0.1:{BRIDGE_PORT}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    url: str | None = None
    deadline = time.time() + 90
    if proc.stdout is None:
        raise RuntimeError("No se pudo leer la salida de cloudflared.")
    while time.time() < deadline:
        line = proc.stdout.readline()
        if not line:
            break
        match = TUNNEL_URL_RE.search(line)
        if match:
            url = match.group(0)
            break
    if not url:
        proc.terminate()
        raise RuntimeError("No se obtuvo una URL trycloudflare en 90s. Revisa tu conexión.")
    return proc, url


def main() -> None:
    if not _has_mt5():
        pass  # el aviso ya se imprime dentro
    ensure_python_deps()
    bridge = start_bridge()
    time.sleep(2)
    try:
        tunnel, url = start_tunnel()
        health = _check(f"{url}/health")
        log("", color=pink)
        log("=" * 64, pink)
        log(bold + "📱 MÓVIL — abre ESTA dirección (conecta LIVE automáticamente):" + reset, green)
        log(bold + "     " + url + reset, green)
        if DASHBOARD_URL:
            log("", color=pink)
            log("🌐 En cualquier navegador usa tu página fija (se setea el túnel una vez):", pink)
            log(bold + "     " + DASHBOARD_URL + "?bridge=" + url + reset, green)
        log("=" * 64, pink)
        log("", color=pink)
        log("Health: " + (health if health else "sin respuesta (¿MT5 abierto y logueado?)"), green if health else yellow)
        log("Deja esta consola abierta. Con Ctrl+C se detiene todo (túnel + bridge).", reset)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        tunnel.terminate()
    finally:
        bridge.terminate()
    log("\nDetenido. Para volver a activarlo, ejecuta de nuevo el launcher.", reset)


def _check(url: str) -> str:
    try:
        proc = subprocess.run(
            [sys.executable, "-c", "import urllib.request,sys;print(urllib.request.urlopen(sys.argv[1],timeout=6).getcode())", url],
            capture_output=True, text=True, timeout=15,
        )
        return "OK 200" if proc.stdout.strip() == "200" else ""
    except Exception:
        return ""


def _has_mt5() -> bool:
    try:
        import MetaTrader5  # noqa: F401
        return True
    except Exception:
        log("[aviso] No se detectó el paquete MetaTrader5 todavía. requirements.txt lo instalará; el bridge solo se conecta si el terminal MT5 está instalado y logueado en este Windows.", yellow)
        return False


if __name__ == "__main__":
    main()