from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from mt5_bridge.service import reconnect_loop, service
from api.agents import attribute

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")
logger = logging.getLogger("mision_control.api")
ROOT = Path(__file__).resolve().parent.parent
stop_event = threading.Event()
worker: threading.Thread | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global worker
    service.connect()
    worker = threading.Thread(target=reconnect_loop, args=(stop_event,), daemon=True, name="mt5-keepalive")
    worker.start()
    yield
    stop_event.set()
    service.close()


app = FastAPI(title="Misión Control API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


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


@app.get("/", include_in_schema=False)
def frontend():
    return FileResponse(ROOT / "index.html")


# Optional static asset mount for future CSS/JS extraction.
app.mount("/static", StaticFiles(directory=ROOT), name="static")
