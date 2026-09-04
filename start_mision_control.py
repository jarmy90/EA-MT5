"""Start the read-only MT5 bridge from any directory on Windows."""
from __future__ import annotations

import importlib.util
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = os.getenv("BRIDGE_HOST", "127.0.0.1")
PORT = int(os.getenv("BRIDGE_PORT", "8000"))
URL = f"http://{HOST}:{PORT}"


def dependencies_ready() -> bool:
    return all(importlib.util.find_spec(name) for name in ("fastapi", "uvicorn", "dotenv"))


def install_dependencies() -> None:
    print("[INFO] Installing Python dependencies...")
    result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], cwd=ROOT)
    if result.returncode != 0:
        raise SystemExit("[ERROR] Could not install Python dependencies.")


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) == 0


def ready(url: str, token: str) -> bool:
    try:
        request = urllib.request.Request(f"{url}/health")
        if token:
            request.add_header("Authorization", f"Bearer {token}")
        with urllib.request.urlopen(request, timeout=2) as response:
            return response.status == 200
    except (OSError, urllib.error.HTTPError):
        return False


def main() -> None:
    if not dependencies_ready():
        install_dependencies()

    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env", override=False)
    global HOST, PORT, URL
    HOST = os.getenv("BRIDGE_HOST", "127.0.0.1")
    PORT = int(os.getenv("BRIDGE_PORT", "8000"))
    URL = f"http://{HOST}:{PORT}"

    print(f"[INFO] Project folder: {ROOT}")

    if port_in_use(PORT):
        raise SystemExit(f"[ERROR] Port {PORT} is already in use. Close the previous bridge first.")

    token = (os.getenv("BRIDGE_TOKEN") or os.getenv("MT5_BRIDGE_TOKEN") or "").strip()
    command = [sys.executable, "-m", "uvicorn", "api.main:app", "--host", HOST, "--port", str(PORT)]
    process = subprocess.Popen(command, cwd=ROOT)
    try:
        for _ in range(30):
            if ready(URL, token):
                print(f"[OK] MT5 bridge available at {URL}")
                print("[INFO] Keep this window open while the cloud dashboard is connected.")
                print("[INFO] Press Ctrl+C to stop the bridge.")
                while process.poll() is None:
                    time.sleep(1)
                raise SystemExit("[ERROR] The MT5 bridge stopped unexpectedly.")
            if process.poll() is not None:
                raise SystemExit("[ERROR] The MT5 bridge failed to start.")
            time.sleep(1)
        raise SystemExit("[ERROR] The bridge did not respond within 30 seconds.")
    except KeyboardInterrupt:
        print("\n[INFO] Stopping bridge...")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    main()
