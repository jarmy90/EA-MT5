"""Tests for agent attribution, auto-discovery, and P&L formula."""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.agents import (
    ALL_AGENTS,
    attribute,
    compact_position,
    floating_pnl,
    _discover_magics,
    _group_for_symbol,
)


# --- P&L formula ---

def test_floating_pnl_includes_all_components():
    pos = {"profit": 10.0, "swap": -2.5, "commission": -1.5}
    assert floating_pnl(pos) == 6.0


def test_floating_pnl_missing_fields():
    pos = {"profit": 5.0}
    assert floating_pnl(pos) == 5.0


# --- Symbol group resolution ---

def test_group_for_ustec():
    assert _group_for_symbol("USTEC") == "NQ"


def test_group_for_xauusd():
    assert _group_for_symbol("XAUUSD") == "XAU"


def test_group_for_unknown():
    assert _group_for_symbol("EURUSD") is None


# --- Round-robin attribution ---

def test_round_robin_ustec_between_alpha_sigma():
    result = attribute([
        {"ticket": 1, "symbol": "USTEC", "type": 0, "profit": 4},
        {"ticket": 2, "symbol": "USTEC", "type": 1, "profit": -2},
    ])
    assert result["NQ-ALPHA"]["count"] == 1
    assert result["NQ-SIGMA"]["count"] == 1
    assert result["XAU-PRIME"]["count"] == 0
    assert result["XAU-FLASH"]["count"] == 0


def test_xau_not_duplicated():
    result = attribute([
        {"ticket": 1, "symbol": "XAUUSD", "type": 0, "profit": 8},
    ])
    total_xau = result["XAU-PRIME"]["count"] + result["XAU-FLASH"]["count"]
    assert total_xau == 1


def test_unknown_symbol_does_not_crash():
    result = attribute([
        {"ticket": 1, "symbol": "EURGBP", "type": 0, "profit": 1},
    ])
    assert isinstance(result, dict)
    assert set(result.keys()) == set(ALL_AGENTS)


# --- Magic priority ---

def test_magic_has_priority(monkeypatch):
    monkeypatch.setenv("AGENT_MAP", json.dumps([
        {"id": "NQ-ALPHA", "symbols": ["USTEC"], "magics": [111001], "tags": []},
        {"id": "NQ-SIGMA", "symbols": ["USTEC"], "magics": [], "tags": []},
        {"id": "XAU-PRIME", "symbols": ["XAUUSD"], "magics": [], "tags": []},
        {"id": "XAU-FLASH", "symbols": ["XAUUSD"], "magics": [], "tags": []},
    ]))
    result = attribute([{"ticket": 1, "symbol": "USTEC", "magic": 111001, "type": 0, "profit": 3}])
    assert result["NQ-ALPHA"]["count"] == 1
    assert result["NQ-SIGMA"]["count"] == 0


# --- Auto-discovery ---

def test_discover_magics_groups_correctly():
    positions = [
        {"ticket": 1, "symbol": "USTEC", "magic": 111001, "type": 0, "profit": 4},
        {"ticket": 2, "symbol": "USTEC", "magic": 111002, "type": 1, "profit": -2},
        {"ticket": 3, "symbol": "XAUUSD", "magic": 222001, "type": 0, "profit": 8},
    ]
    result = _discover_magics(positions)
    assert "NQ-ALPHA" in result or "NQ-SIGMA" in result
    assert len(result.get("NQ-ALPHA", [])) + len(result.get("NQ-SIGMA", [])) == 2
    assert len(result.get("XAU-PRIME", [])) + len(result.get("XAU-FLASH", [])) == 1


def test_auto_discovery_persists(monkeypatch, tmp_path):
    auto_file = tmp_path / "agent_map.auto.json"
    mapping = {"NQ-ALPHA": [111001], "NQ-SIGMA": [111002], "XAU-PRIME": [222001]}
    auto_file.write_text(json.dumps(mapping))

    monkeypatch.delenv("AGENT_MAP", raising=False)
    with patch("api.agents.AUTO_MAP_PATH", auto_file):
        result = attribute([
            {"ticket": 1, "symbol": "USTEC", "magic": 111001, "type": 0, "profit": 4},
            {"ticket": 2, "symbol": "USTEC", "magic": 111002, "type": 1, "profit": -2},
            {"ticket": 3, "symbol": "XAUUSD", "magic": 222001, "type": 0, "profit": 8},
        ])
    assert result["NQ-ALPHA"]["count"] == 1
    assert result["NQ-SIGMA"]["count"] == 1
    assert result["XAU-PRIME"]["count"] == 1
    assert result["XAU-FLASH"]["count"] == 0


# --- Compact position ---

def test_compact_position_normalizes_type():
    pos = {"ticket": 1, "symbol": "USTEC", "type": 0, "profit": 5, "swap": -1, "commission": -0.5}
    compact = compact_position(pos)
    assert compact["side"] == "buy"
    assert compact["profit"] == 3.5


def test_compact_position_sell():
    pos = {"ticket": 2, "symbol": "XAUUSD", "type": "sell", "profit": -3}
    compact = compact_position(pos)
    assert compact["side"] == "sell"
