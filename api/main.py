"""Read-only MetaTrader 5 bridge for Quantora Orbit.

The bridge reads the already-open desktop terminal session first. It never sends,
modifies, closes, or cancels orders and exposes only authenticated JSON endpoints.
"""
from __future__ import annotations

import json
import os
import secrets
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from mt5_bridge.telemetry import TelemetryTracker

load_dotenv()

try:
    import MetaTrader5 as mt5  # type: ignore
    _MT5_AVAILABLE = True
    _MT5_IMPORT_ERROR: Optional[str] = None
except Exception as exc:  # pragma: no cover - Windows-only dependency
    mt5 = None  # type: ignore
    _MT5_AVAILABLE = False
    _MT5_IMPORT_ERROR = str(exc)

BRIDGE_TOKEN = (os.getenv("BRIDGE_TOKEN") or os.getenv("MT5_BRIDGE_TOKEN") or "").strip()
POLL_INTERVAL = float(os.getenv("BRIDGE_POLL_INTERVAL", "1.0"))


def _starting_balance() -> float:
    """Bot starting capital; defaults to 1350 for backward compatibility."""
    try:
        value = float(os.getenv("STARTING_BALANCE", "1350"))
    except ValueError:
        return 1350.0
    return value if value > 0 else 1350.0


def _currency_rates() -> Dict[str, float]:
    """Private multipliers that convert account currency profit fields to EUR.

    Example for a USD account: CURRENCY_RATES={"USD":0.8531}. Values stay on the
    bridge; the dashboard only receives already-converted numbers.
    """
    raw = (os.getenv("CURRENCY_RATES") or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    rates: Dict[str, float] = {}
    for key, value in parsed.items():
        try:
            rate = float(value)
        except (TypeError, ValueError):
            continue
        if rate > 0:
            rates[str(key).upper()] = rate
    return rates


STARTING_BALANCE = _starting_balance()
CURRENCY_RATES = _currency_rates()


def _agent_config() -> List[Dict[str, Any]]:
    """Load all identities from private env vars; absent magics never match positions."""
    agents: List[Dict[str, Any]] = []
    for index in range(1, 5):
        raw_magic = os.getenv(f"BOT_{index}_MAGIC", "").strip()
        magic = int(raw_magic) if raw_magic.lstrip("-").isdigit() else None
        agents.append({
            "id": f"bot-{index}",
            "name": os.getenv(f"BOT_{index}_NAME", f"Bot {index}").strip() or f"Bot {index}",
            "magic": magic,
            "symbol": os.getenv(f"BOT_{index}_SYMBOL", "").strip() or None,
        })

    # AGENT_MAP remains supported for existing private deployments, without defaults.
    raw_map = os.getenv("AGENT_MAP", "").strip()
    if raw_map:
        try:
            configured = json.loads(raw_map)
            if isinstance(configured, list) and len(configured) == 4:
                for index, item in enumerate(configured):
                    if isinstance(item, dict):
                        if item.get("id"):
                            agents[index]["id"] = str(item["id"])
                        if item.get("displayName") or item.get("name"):
                            agents[index]["name"] = str(item.get("displayName") or item.get("name"))
                        if item.get("magic") is not None:
                            agents[index]["magic"] = int(item["magic"])
                        elif isinstance(item.get("magics"), list) and len(item["magics"]) == 1:
                            agents[index]["magic"] = int(item["magics"][0])
                        if isinstance(item.get("symbols"), list) and item["symbols"]:
                            agents[index]["symbol"] = str(item["symbols"][0])
        except (ValueError, TypeError, json.JSONDecodeError):
            pass
    return agents


AGENTS = _agent_config()
_tracker = TelemetryTracker(alpha=float(os.getenv("VELOCITY_EMA_ALPHA", "0.35")))
_lock = threading.Lock()


def _eur_rate(currency: str) -> float:
    """Return the multiplier that converts account currency into display currency."""
    upper = str(currency or "").upper()
    return CURRENCY_RATES.get(upper, 1.0)
def _timestamp(now: float) -> str:
    return datetime.fromtimestamp(now, timezone.utc).isoformat()


def _empty_bots(now: float) -> List[Dict[str, Any]]:
    return [{
        "id": agent["id"],
        "name": agent["name"],
        "active": False,
        "state": "flat",
        "symbol": None,
        "pnl": 0.0,
        "profit": 0.0,
        "swap": 0.0,
        "commission": 0.0,
        "volume": 0.0,
        "openPositions": 0,
        "exposurePct": 0.0,
        "balanceUsagePct": 0.0,
        "pnlVelocity": 0.0,
        "marketVelocity": 0.0,
        "priceAverage": None,
        "priceCurrent": None,
        "updatedAt": _timestamp(now),
    } for agent in AGENTS]


_snapshot: Dict[str, Any] = {
    "status": {"connected": False, "last_error": "Not connected", "timestamp": None},
    "account": None,
    "balance": 0.0,
    "equity": 0.0,
    "floatingPnl": 0.0,
    "startingBalance": STARTING_BALANCE,
    "totalReturn": 0.0,
    "totalReturnPct": 0.0,
    "currency": "EUR",
    "source": "bridge",
    "connectionState": "disconnected",
    "bots": _empty_bots(time.time()),
    "timestamp": None,
}
_mt5_ready = False


def _ensure_mt5() -> str | None:
    global _mt5_ready
    if not _MT5_AVAILABLE or mt5 is None:
        return _MT5_IMPORT_ERROR or "MetaTrader5 package unavailable"
    if _mt5_ready and mt5.terminal_info() and mt5.account_info():
        return None
    login = int(os.getenv("MT5_LOGIN", "0") or 0) or None
    password = os.getenv("MT5_PASSWORD") or None
    server = os.getenv("MT5_SERVER") or None
    path = os.getenv("MT5_PATH") or None
    try:
        if login or password:
            initialized = mt5.initialize(path=path, login=login, password=password, server=server) if path else mt5.initialize(login=login, password=password, server=server)
        else:
            initialized = mt5.initialize(path=path) if path else mt5.initialize()
        if not initialized:
            return f"initialize failed: {mt5.last_error()}"
        _mt5_ready = True
        return None
    except Exception as exc:  # pragma: no cover
        return str(exc)


def _mask_position(position: Any) -> Dict[str, Any]:
    """Copy only position market/account fields needed for read-only analytics."""
    return {
        "ticket": getattr(position, "ticket", None),
        "magic": getattr(position, "magic", None),
        "symbol": getattr(position, "symbol", None),
        "type": getattr(position, "type", None),
        "volume": getattr(position, "volume", None),
        "price_open": getattr(position, "price_open", None),
        "price_current": getattr(position, "price_current", None),
        "profit": getattr(position, "profit", None),
        "swap": getattr(position, "swap", None),
        "commission": getattr(position, "commission", None),
    }


def _disconnected_snapshot(now: float, error: str) -> Dict[str, Any]:
    return {
        "status": {"connected": False, "last_error": error, "timestamp": _timestamp(now)},
        "account": None,
        "balance": 0.0,
        "equity": 0.0,
        "floatingPnl": 0.0,
        "startingBalance": STARTING_BALANCE,
        "totalReturn": 0.0,
        "totalReturnPct": 0.0,
        "currency": "EUR",
        "source": "bridge",
        "connectionState": "disconnected",
        "bots": _empty_bots(now),
        "timestamp": _timestamp(now),
    }


def _collect_once() -> Dict[str, Any]:
    now = time.time()
    error = _ensure_mt5()
    if error:
        return _disconnected_snapshot(now, error)

    account_raw = mt5.account_info()
    if account_raw is None:
        return _disconnected_snapshot(now, str(mt5.last_error()))

    account = {
        "balance": float(getattr(account_raw, "balance", 0) or 0),
        "equity": float(getattr(account_raw, "equity", 0) or 0),
        "profit": float(getattr(account_raw, "profit", 0) or 0),
        "margin": float(getattr(account_raw, "margin", 0) or 0),
        "marginFree": float(getattr(account_raw, "margin_free", 0) or 0),
        "marginLevel": float(getattr(account_raw, "margin_level", 0) or 0),
        "leverage": int(getattr(account_raw, "leverage", 0) or 0),
        "currency": str(getattr(account_raw, "currency", "EUR") or "EUR"),
    }
    positions_raw = mt5.positions_get() or []
    positions = [_mask_position(item) for item in positions_raw]
    symbols = {str(agent["symbol"]) for agent in AGENTS if agent.get("symbol")}

    symbols.update(str(item["symbol"]) for item in positions if item.get("symbol"))
    ticks: Dict[str, Dict[str, Any]] = {}
    tick_sizes: Dict[str, float] = {}
    contract_sizes: Dict[str, float] = {}
    for symbol in symbols:
        mt5.symbol_select(symbol, True)
        tick = mt5.symbol_info_tick(symbol)
        info = mt5.symbol_info(symbol)
        if tick is not None:
            ticks[symbol] = {
                "bid": float(getattr(tick, "bid", 0) or 0),
                "ask": float(getattr(tick, "ask", 0) or 0),
                "last": float(getattr(tick, "last", 0) or 0),
                "time": getattr(tick, "time", None),
                "time_msc": getattr(tick, "time_msc", None),
            }
        tick_sizes[symbol] = float(getattr(info, "trade_tick_size", 0) or getattr(info, "point", 0) or 0)
        contract_sizes[symbol] = float(getattr(info, "trade_contract_size", 0) or 1)
    for position in positions:
        symbol = str(position.get("symbol") or "")
        position["contract_size"] = contract_sizes.get(symbol, 1.0)

    bots = _tracker.aggregate(
        positions,
        AGENTS,
        ticks,
        tick_sizes,
        account["balance"],
        account["equity"],
        now,
        history=mt5.history_deals_get(0, int(now) + 60) or [],
        currency_rate=_eur_rate(account["currency"]),
        starting_balance=STARTING_BALANCE * _eur_rate(account["currency"]),
    )
    rate = _eur_rate(account["currency"])
    balance = account["balance"] * rate
    equity = account["equity"] * rate
    return {
        "status": {"connected": True, "last_error": None, "timestamp": _timestamp(now)},
        "account": {**account, "balance": balance, "equity": equity, "profit": account["profit"] * rate, "margin": account["margin"] * rate, "marginFree": account["marginFree"] * rate},
        "positions": positions,
        "ticks": ticks,
        "bots": bots,
        "balance": balance,
        "equity": equity,
        "floatingPnl": equity - balance,
        "margin": account["margin"] * rate,
        "marginFree": account["marginFree"] * rate,
        "marginLevel": account["marginLevel"],
        "leverage": account["leverage"],
        "openPositions": len(positions),
        "startingBalance": STARTING_BALANCE,
        "totalReturn": account["balance"] * rate - STARTING_BALANCE,
        "totalReturnPct": (account["balance"] * rate - STARTING_BALANCE) / STARTING_BALANCE * 100 if STARTING_BALANCE else 0,
        "totalReturnBase": "EUR" if _eur_rate(account["currency"]) != 1.0 else account["currency"],
        "currency": "EUR" if rate != 1.0 else account["currency"],
        "source": "bridge",
        "connectionState": "connected",
        "timestamp": _timestamp(now),
    }


def _poll_loop() -> None:
    global _snapshot
    while True:
        try:
            snapshot = _collect_once()
            balance = float(snapshot.get("balance") or 0)
            starting = STARTING_BALANCE
            snapshot["startingBalance"] = starting
            snapshot["totalReturn"] = balance - starting
            snapshot["totalReturnPct"] = ((balance - starting) / starting * 100) if starting else 0
            with _lock:
                _snapshot = snapshot
        except Exception as exc:  # pragma: no cover
            failure_time = time.time()
            with _lock:
                _snapshot = {
                    "status": {"connected": False, "last_error": str(exc), "timestamp": _timestamp(failure_time)},
                    "account": None,
                    "balance": 0.0,
                    "equity": 0.0,
                    "floatingPnl": 0.0,
                    "startingBalance": STARTING_BALANCE,
                    "totalReturn": 0.0,
                    "totalReturnPct": 0.0,
                    "currency": "EUR",
                    "source": "bridge",
                    "connectionState": "disconnected",
                    "bots": _empty_bots(failure_time),
                    "timestamp": _timestamp(failure_time),
                }
        time.sleep(POLL_INTERVAL)


app = FastAPI(title="Quantora Orbit MT5 Read-only Bridge", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=False, allow_methods=["GET"], allow_headers=["Authorization"])


def _authorize(authorization: Optional[str]) -> None:
    if BRIDGE_TOKEN and not authorization:
        raise HTTPException(status_code=401, detail="Bridge authorization required")
    if BRIDGE_TOKEN and not secrets.compare_digest(authorization or "", f"Bearer {BRIDGE_TOKEN}"):
        raise HTTPException(status_code=401, detail="Invalid bridge authorization")


@app.get("/health")
def health(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _authorize(authorization)
    with _lock:
        status = _snapshot["status"]
        return {"status": "ok", "connected": status.get("connected", False), "last_error": status.get("last_error"), "timestamp": status.get("timestamp")}


@app.get("/telemetry")
def telemetry(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _authorize(authorization)
    with _lock:
        return dict(_snapshot)


@app.on_event("startup")
def _start_poller() -> None:
    threading.Thread(target=_poll_loop, daemon=True, name="mt5-read-only-poller").start()
