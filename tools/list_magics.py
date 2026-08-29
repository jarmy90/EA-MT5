"""Print open-position magic numbers for configuring AGENT_MAP."""
from __future__ import annotations

import json
import MetaTrader5 as mt5

if not mt5.initialize():
    raise SystemExit(f"No se pudo inicializar MT5: {mt5.last_error()}")

try:
    positions = mt5.positions_get() or []
    rows = []
    for position in positions:
        item = position._asdict()
        print(
            f"ticket={item.get('ticket')} symbol={item.get('symbol')} "
            f"magic={item.get('magic')} comment={item.get('comment')!r} profit={item.get('profit')}"
        )
        rows.append(item)
    print("\nAGENT_MAP sugerido:")
    print(json.dumps([
        {"id": "NQ-ALPHA", "symbols": ["USTEC"], "magics": [], "tags": ["ALPHA"]},
        {"id": "NQ-SIGMA", "symbols": ["USTEC"], "magics": [], "tags": ["SIGMA"]},
        {"id": "XAU-PRIME", "symbols": ["XAUUSD"], "magics": [], "tags": ["PRIME"]},
        {"id": "XAU-FLASH", "symbols": ["XAUUSD"], "magics": [], "tags": ["FLASH"]},
    ], separators=(",", ":")))
finally:
    mt5.shutdown()
