import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.agents import attribute


def test_round_robin_and_no_duplication():
    result = attribute([
        {"ticket": 1, "symbol": "USTEC", "type": 0, "profit": 4},
        {"ticket": 2, "symbol": "USTEC", "type": 1, "profit": -2},
        {"ticket": 3, "symbol": "XAUUSD", "type": 0, "profit": 8},
        {"ticket": 4, "symbol": "UNKNOWN", "type": 0, "profit": 1},
    ])
    assert result["NQ-ALPHA"]["count"] == 1
    assert result["NQ-SIGMA"]["count"] == 1
    assert result["XAU-PRIME"]["count"] == 1
    assert result["XAU-FLASH"]["count"] == 0


def test_magic_has_priority(monkeypatch):
    monkeypatch.setenv("AGENT_MAP", '[{"id":"NQ-ALPHA","symbols":["USTEC"],"magics":[111001],"tags":[]},{"id":"NQ-SIGMA","symbols":["USTEC"],"magics":[],"tags":[]},{"id":"XAU-PRIME","symbols":["XAUUSD"],"magics":[],"tags":[]},{"id":"XAU-FLASH","symbols":["XAUUSD"],"magics":[],"tags":[]}]')
    result = attribute([{"ticket": 1, "symbol": "USTEC", "magic": 111001, "type": 0, "profit": 3}])
    assert result["NQ-ALPHA"]["count"] == 1
    assert result["NQ-SIGMA"]["count"] == 0
