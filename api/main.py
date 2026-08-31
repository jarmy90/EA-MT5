"""Bridge read-only de MetaTrader5 para el dashboard WAWA.

Solo lectura: expone posiciones abiertas, cuenta y ticks. NO abre ni cierra operaciones.
Contrato servido (lo que consume src/data/live.ts):
  GET /health     -> HTTP 200 + { status, connected, last_error } (sirve de heartbeat)
  GET /telemetry  -> snapshot JSON con status/account/agents/ticks

El terminal de MetaTrader5 debe estar abierto y autenticado en la misma máquina.
Arranque:  python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import json
import os
import threading
import time
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

# ---------------------------------------------------------------------------
# MetaTrader5 (opcional: falla limpio si no está instalado en esta máquina)
# ---------------------------------------------------------------------------
try:
    import MetaTrader5 as mt5  # type: ignore

    _MT5_AVAILABLE = True
    _MT5_IMPORT_ERROR: Optional[str] = None
except Exception as exc:  # pragma: no cover - depende del entorno local
    mt5 = None  # type: ignore
    _MT5_AVAILABLE = False
    _MT5_IMPORT_ERROR = str(exc)


# ---------------------------------------------------------------------------
# Configuración (ver env.example.txt)
# ---------------------------------------------------------------------------
SYMBOLS = [s.strip() for s in os.getenv("MT5_SYMBOLS", "USTEC,XAUUSD").split(",") if s.strip()]

# Mapeo agente -> símbolo + magic numbers (coincide con las definiciones del frontend).
_DEFAULT_AGENTS = [
    {"displayName": "NQ-ALPHA", "symbols": ["USTEC"], "magics": [111001]},
    {"displayName": "NQ-SIGMA", "symbols": ["USTEC"], "magics": [111002]},
    {"displayName": "XAU-PRIME", "symbols": ["XAUUSD"], "magics": [222001]},
    {"displayName": "XAU-FLASH", "symbols": ["XAUUSD"], "magics": [222002]},
]


def _load_agents() -> List[Dict[str, Any]]:
    try:
        override = json.loads(os.getenv("AGENT_MAP", "")) or None
    except json.JSONDecodeError:
        override = None
    if isinstance(override, list) and override:
        return override
    return _DEFAULT_AGENTS


AGENTS = _load_agents()
POLL_INTERVAL = float(os.getenv("BRIDGE_POLL_INTERVAL", "1.0"))
TICK_STALE_SECONDS = float(os.getenv("TICK_STALE_SECONDS", "60"))

# ---------------------------------------------------------------------------
# Colector en segundo plano: snapshot cacheado para no bloquear el event loop.
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_snapshot: Dict[str, Any] = {
    "status": {"connected": False, "last_error": None},
    "account": None,
    "positions": [],
    "agents": {},
    "ticks": {},
}
_mt5_ready = False


def _ensure_mt5() -> str | None:
    """Devuelve un mensaje de error si MT5 no está disponible, o None si está listo."""
    if not _MT5_AVAILABLE or mt5 is None or not _MT5_AVAILABLE:
        return _MT5_IMPORT_ERROR or "MetaTrader5 package no disponible en esta máquina."
    global _mt5_ready
    if _mt5_ready:
        return None
    login = int(os.getenv("MT5_LOGIN", "0") or 0) or None
    server = os.getenv("MT5_SERVER") or None
    password = os.getenv("MT5_PASSWORD") or None
    if not mt5.initialize(login=login, password=password, server=server):
        err = mt5.last_error()
        return f"initialize() fallo: {err}"
    _mt5_ready = True
    return None


def _collect_once() -> Dict[str, Any]:
    """Lee una snapshot completa de MT5 sin bloquear el servidor FastAPI."""
    out: Dict[str, Any] = {
        "status": {"connected": False, "last_error": None},
        "account": None,
        "positions": [],
        "agents": {},
        "ticks": {},
    }
    error = _ensure_mt5()
    if error:
        out["status"] = {"connected": False, "last_error": error}
        return out

    account_raw = mt5.account_info()
    account = None
    if account_raw is not None:
        account = {
            "balance": float(getattr(account_raw, "balance", 0) or 0),
            "equity": float(getattr(account_raw, "equity", 0) or 0),
            "profit": float(getattr(account_raw, "profit", 0) or 0),
        }
        out["account"] = account

    positions = mt5.positions_get() or []
    out["positions"] = [_mask_pos(pos_instance) for pos_instance in positions]

    # Agrupa posiciones por agente según símbolo/magic.
    by_agent = {a["displayName"]: {"positions": []} for a in AGENTS}
    for pos_instance, mask in zip(positions, out["positions"]):
        symbol = mask.get("symbol")
        magic = mask.get("magic")
        for agent in AGENTS:
            in_symbols = symbol in agent.get("symbols", [])
            in_magics = magic in agent.get("magics", [])
            if in_symbols and (not agent.get("magics") or in_magics):
                by_agent[agent["displayName"]]["positions"].append(mask)
                break
    out["agents"] = by_agent

    # Ticks por símbolo (último tick real).
    for symbol in SYMBOLS:
        info = mt5.symbol_info_tick(symbol)
        if info is None:
            continue
        tick = {
            "bid": getattr(info, "bid", None),
            "ask": getattr(info, "ask", None),
            "last": getattr(info, "last", None),
            "time": getattr(info, "time", None),
            "time_msc": getattr(info, "time_msc", None),
        }
        out["ticks"][symbol] = tick

    out["status"] = {"connected": True, "last_error": None}
    return out


def _mask_pos(pos: Any) -> Dict[str, Any]:
    """Reduce una MqlPosition a la forma RawPosition que espera el frontend."""
    return {
        "ticket": getattr(pos, "ticket", None),
        "symbol": getattr(pos, "symbol", None),
        "type": getattr(pos, "type", None),  # 0=BUY, 1=SELL
        "volume": getattr(pos, "volume", None),
        "price_open": getattr(pos, "price_open", None),
        "price_current": getattr(pos, "price_current", None),
        "sl": getattr(pos, "sl", None),
        "tp": getattr(pos, "tp", None),
        "profit": getattr(pos, "profit", None),
        "swap": getattr(pos, "swap", None),
        "commission": getattr(pos, "commission", None),
        "time": getattr(pos, "time", None),
        "magic": getattr(pos, "magic", None),
    }


def _poll_loop() -> None:
    global _snapshot
    while True:
        try:
            _snapshot = _collect_once()
        except Exception as exc:  # mantener el lazo vivo ante errores puntuales
            _snapshot = {
                "status": {"connected": False, "last_error": str(exc)},
                "account": None,
                "positions": [],
                "agents": {},
                "ticks": {},
            }
        time.sleep(POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Aplicación FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="WAWA MT5 Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, Any]:
    with _lock:
        connected = _snapshot["status"]["connected"]
        last_error = _snapshot["status"].get("last_error")
    return {"status": "ok", "connected": connected, "last_error": last_error}


@app.get("/telemetry")
def telemetry() -> Dict[str, Any]:
    with _lock:
        return dict(_snapshot)


# Sirve el frontend compilado (dist/) en el mismo origen, si existe.
_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")
os.makedirs(_dist, exist_ok=True)
app.mount("/", StaticFiles(directory=_dist, html=True), name="dashboard")


@app.on_event("startup")
def _start_poller() -> None:
    threading.Thread(target=_poll_loop, daemon=True, name="mt5-poller").start()