"""Pure telemetry calculations for the read-only MT5 bridge.

This module deliberately has no MetaTrader5 import so its aggregation and velocity
rules can be tested on any platform without connecting to a trading account.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping


def number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed == parsed else default


def position_pnl(position: Mapping[str, Any]) -> float:
    """Return the broker PnL components exactly once."""
    return number(position.get("profit")) + number(position.get("swap")) + number(position.get("commission"))


def position_state(positions: Iterable[Mapping[str, Any]]) -> str:
    sides = {"long" if str(item.get("type", "")).lower() in {"0", "buy"} else "short"
             for item in positions
             if str(item.get("type", "")).lower() in {"0", "1", "buy", "sell"}}
    if not sides:
        return "flat"
    if len(sides) > 1:
        return "mixed"
    return next(iter(sides))


def position_side(raw: Any) -> str:
    """Normalize an MT5 position/deal type (0/1 or buy/sell) into a display side."""
    text = str(raw).strip().lower()
    return "sell" if text in {"1", "sell"} else "buy"


def agent_magics(agent: Mapping[str, Any]) -> set[int]:
    """All magic numbers aliased to one agent (single magic plus optional list)."""
    magics = {int(number(agent.get("magic"), -1))}
    extra = agent.get("magics")
    if isinstance(extra, (list, tuple)):
        magics.update(int(number(item, -1)) for item in extra)
    return {value for value in magics if value >= 0}


def agent_tags(agent: Mapping[str, Any]) -> list[str]:
    return [str(tag).strip().upper() for tag in (agent.get("tags") or []) if str(tag).strip()]


def match_agent(item: Mapping[str, Any], definitions: list[Mapping[str, Any]]) -> Mapping[str, Any] | None:
    """Assign a position/deal to an agent: magic first, then comment tag + symbol."""
    magic = int(number(item.get("magic"), -1))
    if magic >= 0:
        for agent in definitions:
            if magic in agent_magics(agent):
                return agent
    comment = str(item.get("comment") or "").strip().upper()
    symbol = str(item.get("symbol") or "").strip().upper()
    if comment:
        tagged = [agent for agent in definitions
                  if any(tag in comment for tag in agent_tags(agent))]
        if tagged:
            by_symbol = [agent for agent in tagged
                         if symbol and str(agent.get("symbol") or "").upper() == symbol]
            return (by_symbol or tagged)[0]
    return None


def build_position_lookup(history: Iterable[Mapping[str, Any]]) -> dict[int, dict[str, Any]]:
    """Build position_id -> opening-deal info for resolving closing deals.

    MT5 SL/TP closures have magic=0 and a comment like '[sl 1234.5]'.  The
    *opening* deal for the same position carries the real EA magic and comment.
    We scan all history deals (not just closing ones) and index by position_id
    so we can retroactively attribute any closing deal whose magic and comment
    are not directly matchable.
    """
    lookup: dict[int, dict[str, Any]] = {}
    for deal in history:
        entry = int(number(deal.get("entry"), 1))
        if entry != 0:
            continue  # Only index opening deals (entry == 0 means "in")
        pid = int(number(deal.get("position_id"), 0))
        if pid <= 0:
            continue
        magic = int(number(deal.get("magic"), -1))
        comment = str(deal.get("comment") or "").strip()
        symbol = str(deal.get("symbol") or "").strip()
        if pid not in lookup:
            lookup[pid] = {"magic": -1, "comment": "", "symbol": symbol}
        # Prefer non-zero magic
        if magic > 0 and lookup[pid]["magic"] <= 0:
            lookup[pid]["magic"] = magic
        # Prefer a real EA comment (not a broker [sl/tp] tag)
        existing_comment = lookup[pid]["comment"]
        if comment and not comment.startswith("[sl ") and not comment.startswith("[tp "):
            if not existing_comment or existing_comment.startswith("[sl ") or existing_comment.startswith("[tp "):
                lookup[pid]["comment"] = comment
    return lookup


def mid_price(tick: Mapping[str, Any]) -> float:
    bid = number(tick.get("bid"))
    ask = number(tick.get("ask"))
    last = number(tick.get("last"))
    if bid > 0 and ask > 0:
        return (bid + ask) / 2
    return last


def tick_seconds(tick: Mapping[str, Any]) -> float:
    raw = tick.get("time_msc", tick.get("time"))
    value = number(raw)
    return value / 1000 if tick.get("time_msc") is not None else value


def ema_velocity(previous_velocity: float, delta: float, elapsed: float, alpha: float, signed: bool = False) -> float:
    if elapsed <= 0:
        return previous_velocity
    raw = delta / elapsed if signed else abs(delta) / elapsed
    weight = max(0.0, min(1.0, alpha))
    return previous_velocity + weight * (raw - previous_velocity)


@dataclass
class _BotHistory:
    pnl: float
    timestamp: float
    velocity: float = 0.0


@dataclass
class _TickHistory:
    mid: float
    timestamp: float
    velocity: float = 0.0


class TelemetryTracker:
    """Stateful EMA tracker; it stores only numeric deltas, never credentials."""

    def __init__(self, alpha: float = 0.35) -> None:
        self.alpha = alpha
        self._bots: dict[str, _BotHistory] = {}
        self._ticks: dict[str, _TickHistory] = {}
        self._closed: dict[str, float] = {}

    def market_velocity(self, symbol: str, tick: Mapping[str, Any], tick_size: float, now: float) -> float:
        mid = mid_price(tick)
        stamp = tick_seconds(tick) or now
        previous = self._ticks.get(symbol)
        if not previous or mid <= 0 or tick_size <= 0:
            self._ticks[symbol] = _TickHistory(mid, stamp, 0.0)
            return 0.0
        elapsed = stamp - previous.timestamp
        if elapsed <= 0:
            elapsed = now - previous.timestamp
        velocity = ema_velocity(previous.velocity, (mid - previous.mid) / tick_size, elapsed, self.alpha)
        self._ticks[symbol] = _TickHistory(mid, stamp, velocity)
        return velocity

    def closed_pnl_history(self, bot_id: str) -> float:
        return self._closed.get(bot_id, 0.0)

    def remember_closed_pnl(self, bot_id: str, value: float) -> None:
        self._closed[bot_id] = value

    def pnl_velocity(self, bot_id: str, pnl: float, now: float) -> float:
        previous = self._bots.get(bot_id)
        if not previous:
            self._bots[bot_id] = _BotHistory(pnl, now, 0.0)
            return 0.0
        velocity = ema_velocity(previous.velocity, pnl - previous.pnl, now - previous.timestamp, self.alpha, signed=True)
        self._bots[bot_id] = _BotHistory(pnl, now, velocity)
        return velocity

    def aggregate(
        self,
        positions: Iterable[Mapping[str, Any]],
        agents: Iterable[Mapping[str, Any]],
        ticks: Mapping[str, Mapping[str, Any]],
        tick_sizes: Mapping[str, float],
        balance: float,
        equity: float,
        now: float | None = None,
        history: Iterable[Mapping[str, Any]] | None = None,
        currency_rate: float = 1.0,
        starting_balance: float | None = None,
    ) -> list[dict[str, Any]]:
        current = now if now is not None else datetime.now(timezone.utc).timestamp()
        definitions: list[Mapping[str, Any]] = list(agents)
        grouped: dict[str, list[Mapping[str, Any]]] = {str(agent["id"]): [] for agent in definitions}
        for position in positions:
            agent = match_agent(position, definitions)
            if agent is not None:
                grouped[str(agent["id"])].append(position)

        # Build position_id lookup from all history deals.
        # Opening deals (entry==0) carry the real EA magic/comment; closing deals
        # triggered by SL/TP have magic=0 and a '[sl price]' comment. We use the
        # lookup so closing deals are attributed to the same bot as their opener.
        all_history: list[Mapping[str, Any]] = list(history or [])
        position_lookup = build_position_lookup(all_history)

        # Closed P&L per bot: every closing deal (entry != "in") owned by that bot.
        # Resolution order:
        #   1. Direct magic/comment match on the closing deal itself.
        #   2. position_id lookup -> use opening deal's magic/comment.
        #   3. 80/20 fallback: unattributed PnL -> 80% StochExtreme, 20% Triangulo.
        closed_pnl: dict[str, float] = {str(agent["id"]): 0.0 for agent in definitions}
        closed_trades: dict[str, int] = {str(agent["id"]): 0 for agent in definitions}
        wins: dict[str, int] = {str(agent["id"]): 0 for agent in definitions}
        unattributed_pnl = 0.0

        for deal in all_history:
            entry = int(number(deal.get("entry"), 1))
            deal_type = int(number(deal.get("type"), -1))
            if entry == 0 or deal_type not in (0, 1):
                continue

            agent = match_agent(deal, definitions)

            # Step 2: try position_id lookup if direct match failed
            if agent is None:
                pid = int(number(deal.get("position_id"), 0))
                if pid > 0 and pid in position_lookup:
                    info = position_lookup[pid]
                    proxy: dict[str, Any] = dict(deal)
                    if info.get("magic", -1) > 0:
                        proxy["magic"] = info["magic"]
                    if info.get("comment"):
                        proxy["comment"] = info["comment"]
                    agent = match_agent(proxy, definitions)

            profit = position_pnl(deal)

            if agent is None:
                # Step 3: accumulate for 80/20 fallback
                unattributed_pnl += profit
                continue

            bot_id = str(agent["id"])
            closed_pnl[bot_id] += profit
            closed_trades[bot_id] += 1
            if profit > 0:
                wins[bot_id] += 1

        # Apply 80/20 fallback for any remaining truly-unattributed PnL.
        # 80% -> first bot tagged STOCHEXTREME, 20% -> first bot tagged FIRSTTRIANGLE.
        if unattributed_pnl != 0.0:
            stoch_bot: Mapping[str, Any] | None = next(
                (a for a in definitions if "STOCHEXTREME" in agent_tags(a)), None
            )
            tri_bot: Mapping[str, Any] | None = next(
                (a for a in definitions if "FIRSTTRIANGLE" in agent_tags(a)), None
            )
            if stoch_bot is not None:
                closed_pnl[str(stoch_bot["id"])] += unattributed_pnl * 0.80
            if tri_bot is not None:
                closed_pnl[str(tri_bot["id"])] += unattributed_pnl * 0.20

        # Bot-level percentages use the account starting capital when provided;
        # otherwise they fall back to balance minus current floating P&L.
        total_floating = sum(position_pnl(item) for items in grouped.values() for item in items)
        bot_base = starting_balance if starting_balance and starting_balance > 0 else balance - total_floating
        if bot_base <= 0:
            bot_base = balance if balance > 0 else 0.0

        output: list[dict[str, Any]] = []
        for agent in definitions:
            bot_id = str(agent["id"])
            items = grouped[bot_id]
            pnl = sum(position_pnl(item) for item in items)
            symbols = sorted({str(item.get("symbol")) for item in items if item.get("symbol")})
            symbol = symbols[0] if len(symbols) == 1 else ("MIXED" if symbols else None)
            volume = sum(number(item.get("volume")) for item in items)
            gross_notional = sum(abs(number(item.get("volume")) * number(item.get("price_current"))) * number(item.get("contract_size"), 1) for item in items)
            denominator_balance = balance if balance > 0 else 0
            denominator_equity = equity if equity > 0 else denominator_balance
            market = self.market_velocity(symbol, ticks[symbol], tick_sizes.get(symbol, 0), current) if symbol and symbol in ticks else 0.0
            closed = closed_pnl[bot_id] * max(0.0, currency_rate)
            floating_pct = pnl / bot_base * 100 if bot_base else 0.0
            closed_pct = closed / bot_base * 100 if bot_base else 0.0
            output.append({
                "id": bot_id,
                "name": str(agent.get("name") or bot_id),
                "active": bool(items),
                "state": position_state(items),
                "symbol": symbol,
                "pnl": round(pnl, 2),
                "closedPnl": round(closed, 2),
                "floatingReturnPct": round(floating_pct, 3),
                "closedReturnPct": round(closed_pct, 3),
                "totalReturnPct": round(floating_pct + closed_pct, 3),
                "closedTrades": closed_trades[bot_id],
                "winRatePct": round(wins[bot_id] / closed_trades[bot_id] * 100, 1) if closed_trades[bot_id] else 0.0,
                "positions": [{
                    "ticket": int(number(item.get("ticket"), 0)),
                    "symbol": str(item.get("symbol") or ""),
                    "side": position_side(item.get("type")),
                    "volume": round(number(item.get("volume")), 2),
                    "priceOpen": number(item.get("price_open")) or None,
                    "priceCurrent": number(item.get("price_current")) or None,
                    "profit": round(position_pnl(item), 2),
                } for item in sorted(items, key=lambda p: number(p.get("ticket")))],
                "profit": round(sum(number(item.get("profit")) for item in items), 2),
                "swap": round(sum(number(item.get("swap")) for item in items), 2),
                "commission": round(sum(number(item.get("commission")) for item in items), 2),
                "volume": round(volume, 4),
                "openPositions": len(items),
                "exposurePct": round(gross_notional / denominator_equity * 100, 4) if denominator_equity else 0,
                "balanceUsagePct": round(gross_notional / denominator_balance * 100, 4) if denominator_balance else 0,
                "pnlVelocity": round(self.pnl_velocity(bot_id, pnl, current), 6),
                "marketVelocity": round(market, 6),
                "priceAverage": round(sum(number(item.get("price_open")) * number(item.get("volume")) for item in items) / volume, 6) if volume else None,
                "priceCurrent": round(sum(number(item.get("price_current")) * number(item.get("volume")) for item in items) / volume, 6) if volume else None,
                "updatedAt": datetime.fromtimestamp(current, timezone.utc).isoformat(),
            })
        return output
