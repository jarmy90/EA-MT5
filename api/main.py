from __future__ import annotations

import logging
import subprocess
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Build hash resolved once at import time
try:
    BUILD_HASH = subprocess.check_output(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=str(Path(__file__).resolve().parent.parent),
        stderr=subprocess.DEVNULL,
    ).decode().strip()
except Exception:
    BUILD_HASH = "dev"
BUILD_TIME = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from mt5_bridge.service import reconnect_loop, service
from api.agents import attribute, get_agent_map

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")
logger = logging.getLogger("mision_control.api")
ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT / "static"
stop_event = threading.Event()
worker: threading.Thread | None = None


# ---------------------------------------------------------------------------
# Cache-control middleware: no-store for HTML, no-cache for static assets
# ---------------------------------------------------------------------------
class CacheControlMiddleware:
    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response = Response()
        await self.app(scope, receive, response.receive, response.send)
        path = scope.get("path", "")

        if path.endswith(".html") or path == "/":
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        elif path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-cache, must-revalidate"

        await response(scope, receive, send)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global worker
    service.connect()
    worker = threading.Thread(target=reconnect_loop, args=(stop_event,), daemon=True, name="mt5-keepalive")
    worker.start()
    yield
    stop_event.set()
    service.close()


app = FastAPI(title="Misión Control API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/status")
def status():
    return service.status()


@app.get("/account")
def account():
    value = service.account()
    if value is None:
        raise HTTPException(503, "MetaTrader 5 is not connected")
    return value


@app.get("/positions")
def positions():
    return service.positions()


@app.get("/telemetry")
def telemetry():
    payload = service.telemetry()
    payload["agents"] = attribute(payload.get("positions", []))
    return payload


@app.get("/agents/map")
def agents_map():
    """Return the resolved agent-magic mapping (read-only)."""
    return get_agent_map()


@app.get("/tick/{symbol}")
def tick(symbol: str):
    value = service.tick(symbol.upper())
    if value is None:
        raise HTTPException(503, f"No tick available for {symbol}")
    return value


@app.get("/rates/{symbol}")
def rates(symbol: str, timeframe: str = Query("M15", pattern="^(M1|M5|M15|M30|H1|H4|D1)$"), count: int = Query(200, ge=1, le=5000)):
    return service.rates(symbol.upper(), timeframe, count)


@app.get("/health")
def health():
    return {"ok": service.ensure_connection()}


@app.get("/version")
def version():
    return {"build": BUILD_HASH, "built_utc": BUILD_TIME}


@app.get("/", include_in_schema=False)
def frontend():
    return FileResponse(ROOT / "index.html", headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


# Serve static assets (pixel_worker.js, future CSS/JS)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
