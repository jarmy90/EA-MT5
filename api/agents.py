"""Position attribution for the four Mission Control desks."""
from __future__ import annotations

import json
import os
from typing import Any

DEFAULT_AGENTS = [
    {"id": "NQ-ALPHA", "symbols": ["USTEC", "NAS100", "NQ100", "US100", "NDX"], "magics": [], "tags": []},
    {"id": "NQ-SIGMA", "symbols": ["USTEC", "NAS100", "NQ100", "US100", "NDX"], "magics": [], "tags": []},
    {"id": "XAU-PRIME", "symbols": ["XAUUSD", "GOLD", "XAU"], "magics": [], "tags": []},
    {"id": "XAU-FLASH", "symbols": ["XAUUSD", "GOLD", "XAU"], "magics": [], "tags": []},
]


def load_agents() -> list[dict[str, Any]]:
    raw = os.getenv("AGENT_MAP")
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list) and parsed:
                return parsed
        except (TypeError, ValueError):
            pass
    return DEFAULT_AGENTS


def matches_symbol(symbol: str, symbols: list[str]) -> bool:
    value = (symbol or "").upper()
    return any(value == item.upper() or value.startswith(item.upper()) or item.upper() in value for item in symbols)


def compact_position(position: dict[str, Any]) -> dict[str, Any]:
    raw_type = str(position.get("type", ""))
    side = "buy" if raw_type in {"0", "buy", "BUY"} else "sell"
    profit = round(float(position.get("profit") or 0) + float(position.get("swap") or 0), 2)
    return {
        "ticket": position.get("ticket"),
        "symbol": position.get("symbol"),
        "side": side,
        "volume": position.get("volume"),
        "price_open": position.get("price_open"),
        "price_current": position.get("price_current"),
        "profit": profit,
        "magic": position.get("magic"),
        "comment": position.get("comment"),
    }


def attribute(positions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    agents = load_agents()
    output = {agent["id"]: {"positions": [], "count": 0, "profit": 0.0} for agent in agents}
    pending: list[dict[str, Any]] = []

    for position in positions:
        placed = False
        comment = str(position.get("comment") or "").upper()
        for agent in agents:
            magics = {int(value) for value in agent.get("magics", []) if str(value).lstrip("-").isdigit()}
            tags = [str(value).upper() for value in agent.get("tags", [])]
            if position.get("magic") in magics or any(comment.startswith(tag) for tag in tags):
                output[agent["id"]]["positions"].append(compact_position(position))
                placed = True
                break
        if not placed:
            pending.append(position)

    grouped: dict[str, list[dict[str, Any]]] = {}
    for position in pending:
        grouped.setdefault(str(position.get("symbol") or "").upper(), []).append(position)
    for symbol, items in grouped.items():
        owners = [agent for agent in agents if matches_symbol(symbol, agent.get("symbols", []))]
        for index, position in enumerate(sorted(items, key=lambda item: item.get("ticket", 0))):
            if owners:
                output[owners[index % len(owners)]["id"]]["positions"].append(compact_position(position))

    for item in output.values():
        item["count"] = len(item["positions"])
        item["profit"] = round(sum(position["profit"] for position in item["positions"]), 2)
    return output
