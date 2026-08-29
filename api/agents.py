"""Position attribution for the four Mission Control desks.

Priority:
1. AGENT_MAP from environment (manual override)
2. data/agent_map.auto.json (auto-discovered, persistent)
3. Round-robin by symbol group (fallback)

Floating P&L formula: profit + swap + commission  (same everywhere).
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
AUTO_MAP_PATH = ROOT / "data" / "agent_map.auto.json"
_lock = threading.Lock()

# Symbol groups: each group maps to a pair of agents.
SYMBOL_GROUPS: dict[str, list[str]] = {
    "NQ": ["NQ-ALPHA", "NQ-SIGMA"],
    "XAU": ["XAU-PRIME", "XAU-FLASH"],
}

ALL_AGENTS = ["NQ-ALPHA", "NQ-SIGMA", "XAU-PRIME", "XAU-FLASH"]

SYMBOL_ALIASES: dict[str, str] = {
    "USTEC": "NQ", "NAS100": "NQ", "NQ100": "NQ", "US100": "NQ", "NDX": "NQ",
    "XAUUSD": "XAU", "GOLD": "XAU", "XAU": "XAU",
}


def _group_for_symbol(symbol: str) -> str | None:
    upper = (symbol or "").upper()
    return SYMBOL_ALIASES.get(upper)


def _resolve_agents_from_map(raw: str | None) -> list[dict[str, Any]] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list) and parsed:
            return parsed
    except (TypeError, ValueError):
        pass
    return None


def _load_manual_agents() -> list[dict[str, Any]] | None:
    return _resolve_agents_from_map(os.getenv("AGENT_MAP"))


def _load_auto_map() -> dict[str, list[int]]:
    if not AUTO_MAP_PATH.exists():
        return {}
    try:
        data = json.loads(AUTO_MAP_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return {k: [int(m) for m in v if str(m).lstrip("-").isdigit()] for k, v in data.items()}
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def _save_auto_map(mapping: dict[str, list[int]]) -> None:
    AUTO_MAP_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUTO_MAP_PATH.write_text(json.dumps(mapping, indent=2, sort_keys=True), encoding="utf-8")


def _discover_magics(positions: list[dict[str, Any]]) -> dict[str, list[int]]:
    """Group live positions by (symbol_group, magic) and auto-assign to agents."""
    group_magics: dict[str, set[int]] = {}
    for pos in positions:
        symbol = str(pos.get("symbol") or "").upper()
        magic = pos.get("magic")
        group = _group_for_symbol(symbol)
        if group and isinstance(magic, int) and magic != 0:
            group_magics.setdefault(group, set()).add(magic)

    mapping: dict[str, list[int]] = {}
    for group, magics in group_magics.items():
        agent_names = SYMBOL_GROUPS.get(group, [])
        sorted_magics = sorted(magics)
        for i, magic in enumerate(sorted_magics):
            agent = agent_names[i % len(agent_names)] if agent_names else f"UNASSIGNED-{i}"
            mapping.setdefault(agent, []).append(magic)
    return mapping


def get_agent_map() -> dict[str, Any]:
    """Return the current resolved agent-magic mapping for /agents/map endpoint."""
    manual = _load_manual_agents()
    if manual:
        return {a.get("id", "?"): {"magics": a.get("magics", []), "symbols": a.get("symbols", [])} for a in manual}
    auto = _load_auto_map()
    if auto:
        return {agent: {"magics": magics, "symbols": []} for agent, magics in auto.items()}
    return {}


def matches_symbol(symbol: str, symbols: list[str]) -> bool:
    value = (symbol or "").upper()
    return any(value == item.upper() or value.startswith(item.upper()) or item.upper() in value for item in symbols)


def floating_pnl(position: dict[str, Any]) -> float:
    """Unified floating P&L: profit + swap + commission."""
    return round(
        float(position.get("profit") or 0)
        + float(position.get("swap") or 0)
        + float(position.get("commission") or 0),
        2,
    )


def compact_position(position: dict[str, Any]) -> dict[str, Any]:
    raw_type = str(position.get("type", ""))
    side = "buy" if raw_type in {"0", "buy", "BUY"} else "sell"
    return {
        "ticket": position.get("ticket"),
        "symbol": position.get("symbol"),
        "side": side,
        "volume": position.get("volume"),
        "price_open": position.get("price_open"),
        "price_current": position.get("price_current"),
        "profit": floating_pnl(position),
        "magic": position.get("magic"),
        "comment": position.get("comment"),
    }


def attribute(positions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    # 1. Check manual AGENT_MAP
    manual = _load_manual_agents()
    if manual:
        return _attribute_with_agents(positions, manual)

    # 2. Check auto-discovered map (persistent)
    auto_map = _load_auto_map()
    if auto_map:
        agents_cfg = [{"id": aid, "symbols": [], "magics": magics, "tags": []} for aid, magics in auto_map.items() if aid in ALL_AGENTS]
        if agents_cfg:
            # Ensure all agents present
            existing_ids = {a["id"] for a in agents_cfg}
            for aid in ALL_AGENTS:
                if aid not in existing_ids:
                    group = "NQ" if "NQ" in aid else "XAU"
                    agents_cfg.append({"id": aid, "symbols": SYMBOL_GROUPS.get(group, []), "magics": [], "tags": []})
            return _attribute_with_agents(positions, agents_cfg)

    # 3. Auto-discover from live positions
    discovered = _discover_magics(positions)
    if discovered:
        with _lock:
            _save_auto_map(discovered)
        agents_cfg = [{"id": aid, "symbols": [], "magics": magics, "tags": []} for aid, magics in discovered.items() if aid in ALL_AGENTS]
        existing_ids = {a["id"] for a in agents_cfg}
        for aid in ALL_AGENTS:
            if aid not in existing_ids:
                group = "NQ" if "NQ" in aid else "XAU"
                agents_cfg.append({"id": aid, "symbols": SYMBOL_GROUPS.get(group, []), "magics": [], "tags": []})
        return _attribute_with_agents(positions, agents_cfg)

    # 4. Fallback: round-robin by symbol group
    return _attribute_round_robin(positions)


def _attribute_with_agents(positions: list[dict[str, Any]], agents_cfg: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = {a["id"]: {"positions": [], "count": 0, "profit": 0.0, "magics": a.get("magics", [])} for a in agents_cfg}
    pending: list[dict[str, Any]] = []

    for position in positions:
        placed = False
        comment = str(position.get("comment") or "").upper()
        for agent in agents_cfg:
            magics = {int(v) for v in agent.get("magics", []) if str(v).lstrip("-").isdigit()}
            tags = [str(v).upper() for v in agent.get("tags", [])]
            if position.get("magic") in magics or any(comment.startswith(tag) for tag in tags):
                output[agent["id"]]["positions"].append(compact_position(position))
                placed = True
                break
        if not placed:
            pending.append(position)

    # Round-robin remaining by symbol group
    grouped: dict[str, list[dict[str, Any]]] = {}
    for position in pending:
        group = _group_for_symbol(str(position.get("symbol") or "")) or str(position.get("symbol") or "").upper()
        grouped.setdefault(group, []).append(position)

    for group, items in grouped.items():
        owners = [a for a in agents_cfg if any(matches_symbol(sym, a.get("symbols", [])) for sym in [group])]
        if not owners:
            # Try matching by agent name containing group prefix
            owners = [a for a in agents_cfg if group.upper() in a["id"].upper()]
        for index, position in enumerate(sorted(items, key=lambda p: p.get("ticket", 0))):
            if owners:
                output[owners[index % len(owners)]["id"]]["positions"].append(compact_position(position))

    for item in output.values():
        item["count"] = len(item["positions"])
        item["profit"] = round(sum(p["profit"] for p in item["positions"]), 2)
    return output


def _attribute_round_robin(positions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    agents = [{"id": aid, "symbols": [], "magics": [], "tags": []} for aid in ALL_AGENTS]
    for agent in agents:
        group = "NQ" if "NQ" in agent["id"] else "XAU"
        agent["symbols"] = SYMBOL_GROUPS.get(group, [])
    return _attribute_with_agents(positions, agents)
