"""Thread-safe, reconnecting read-only adapter around the official MetaTrader5 package."""
from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
import MetaTrader5 as mt5

load_dotenv()
logger = logging.getLogger("mision_control.mt5")

TIMEFRAMES = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}


class MT5Service:
    def __init__(self) -> None:
        self.login = int(os.getenv("MT5_LOGIN", "0") or 0)
        self.password = os.getenv("MT5_PASSWORD", "")
        self.server = os.getenv("MT5_SERVER", "ICMarketsEU-MT5-5")
        self.path = os.getenv("MT5_PATH") or None
        self._lock = threading.RLock()
        self._connected = False
        self._last_error: str | None = None
        self._connected_at: datetime | None = None

    def connect(self) -> bool:
        with self._lock:
            try:
                initialized = mt5.initialize(path=self.path) if self.path else mt5.initialize()
                if not initialized:
                    self._last_error = str(mt5.last_error())
                    logger.error("MT5 initialization failed: %s", self._last_error)
                    self._connected = False
                    return False
                if self.login and self.password:
                    if not mt5.login(login=self.login, password=self.password, server=self.server):
                        self._last_error = str(mt5.last_error())
                        logger.error("MT5 login failed: %s", self._last_error)
                        self._connected = False
                        return False
                # Without credentials, rely on the already-logged-in desktop terminal.
                self._connected = bool(mt5.terminal_info() and mt5.account_info())
                self._connected_at = datetime.now(timezone.utc) if self._connected else None
                self._last_error = None if self._connected else str(mt5.last_error())
                if self._connected:
                    account = mt5.account_info()
                    logger.info("Connected to %s | account=%s", self.server, account.login if account else "unknown")
                return self._connected
            except Exception as exc:  # pragma: no cover - protects the long-running bridge
                self._last_error = str(exc)
                logger.exception("Unexpected MT5 connection error")
                return False

    def ensure_connection(self) -> bool:
        with self._lock:
            if self._connected and mt5.terminal_info() and mt5.account_info():
                return True
            try:
                mt5.shutdown()
            except Exception:
                pass
            return self.connect()

    def close(self) -> None:
        with self._lock:
            mt5.shutdown()
            self._connected = False

    def status(self) -> dict[str, Any]:
        connected = self.ensure_connection()
        terminal = mt5.terminal_info() if connected else None
        return {
            "connected": connected,
            "server": self.server,
            "login": self.login or None,
            "terminal": terminal._asdict() if terminal else None,
            "connected_at": self._connected_at.isoformat() if self._connected_at else None,
            "last_error": self._last_error,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def account(self) -> dict[str, Any] | None:
        if not self.ensure_connection():
            return None
        value = mt5.account_info()
        return value._asdict() if value else None

    def positions(self) -> list[dict[str, Any]]:
        if not self.ensure_connection():
            return []
        values = mt5.positions_get() or []
        return [value._asdict() for value in values]

    def symbols(self) -> list[str]:
        """Return configured symbols so the UI can detect whether markets are producing ticks."""
        configured = os.getenv("MT5_SYMBOLS", "NQ100,XAUUSD,EURUSD")
        return [symbol.strip() for symbol in configured.split(",") if symbol.strip()]

    def telemetry(self) -> dict[str, Any]:
        connected = self.ensure_connection()
        positions = self.positions() if connected else []
        ticks = {symbol: self.tick(symbol) for symbol in self.symbols()} if connected else {}
        return {
            "status": self.status(),
            "account": self.account() if connected else None,
            "positions": positions,
            "ticks": ticks,
        }

    def tick(self, symbol: str) -> dict[str, Any] | None:
        if not self.ensure_connection():
            return None
        mt5.symbol_select(symbol, True)
        value = mt5.symbol_info_tick(symbol)
        return value._asdict() if value else None

    def rates(self, symbol: str, timeframe: str = "M15", count: int = 200) -> list[dict[str, Any]]:
        if not self.ensure_connection():
            return []
        mt5.symbol_select(symbol, True)
        frame = TIMEFRAMES.get(timeframe.upper(), mt5.TIMEFRAME_M15)
        values = mt5.copy_rates_from_pos(symbol, frame, 0, max(1, min(count, 5000)))
        return [value._asdict() for value in values] if values is not None else []


service = MT5Service()


def reconnect_loop(stop_event: threading.Event, interval: int = 10) -> None:
    """Keep the terminal session warm without blocking the FastAPI process."""
    while not stop_event.wait(interval):
        service.ensure_connection()
