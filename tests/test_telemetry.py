import unittest

from mt5_bridge.telemetry import TelemetryTracker, position_pnl, position_side, position_state


class TelemetryTests(unittest.TestCase):
    def test_pnl_aggregates_profit_swap_and_commission(self):
        self.assertEqual(position_pnl({"profit": 10, "swap": -2, "commission": -1}), 7)

    def test_position_side_normalizes_type_codes(self):
        self.assertEqual(position_side(0), "buy")
        self.assertEqual(position_side(1), "sell")
        self.assertEqual(position_side("buy"), "buy")
        self.assertEqual(position_side("SELL"), "sell")

    def test_states_cover_flat_long_short_and_mixed(self):
        self.assertEqual(position_state([]), "flat")
        self.assertEqual(position_state([{"type": 0}]), "long")
        self.assertEqual(position_state([{"type": 1}]), "short")
        self.assertEqual(position_state([{"type": 0}, {"type": 1}]), "mixed")

    def test_aggregate_groups_exclusively_by_magic_number(self):
        tracker = TelemetryTracker(alpha=1)
        agents = [
            {"id": "one", "name": "EA One", "magic": 101},
            {"id": "two", "name": "EA Two", "magic": 202},
            {"id": "three", "name": "EA Three", "magic": 303},
            {"id": "four", "name": "EA Four", "magic": 404},
        ]
        positions = [
            {"magic": 101, "symbol": "EURUSD", "type": 0, "volume": 1, "price_open": 1.1, "price_current": 1.2, "profit": 10, "swap": 1, "commission": -1},
            {"magic": 101, "symbol": "EURUSD", "type": 0, "volume": 2, "price_open": 1.1, "price_current": 1.2, "profit": 5, "swap": 0, "commission": 0},
            {"magic": 202, "symbol": "EURUSD", "type": 1, "volume": 1, "price_open": 1.2, "price_current": 1.1, "profit": -4, "swap": -1, "commission": 0},
            {"magic": 999, "symbol": "EURUSD", "type": 0, "volume": 50, "profit": 999},
        ]
        first = tracker.aggregate(positions, agents, {"EURUSD": {"bid": 1.1, "ask": 1.2, "time_msc": 1000}}, {"EURUSD": 0.0001}, 1000, 1000, now=1)
        self.assertEqual(first[0]["pnl"], 15)
        self.assertEqual(first[0]["openPositions"], 2)
        self.assertEqual(first[1]["pnl"], -5)
        self.assertEqual(first[2]["state"], "flat")
        self.assertFalse(first[2]["active"])
        self.assertEqual(first[3]["pnl"], 0)
        self.assertEqual(set(first[0]) >= {"active", "state", "symbol", "pnl", "profit", "swap", "commission", "volume", "openPositions", "exposurePct", "balanceUsagePct", "pnlVelocity", "marketVelocity", "updatedAt"}, True)

    def test_pnl_and_market_velocity_are_ema_smoothed(self):
        tracker = TelemetryTracker(alpha=1)
        agents = [{"id": str(i), "name": str(i), "magic": i} for i in range(1, 5)]
        positions = [{"magic": 1, "symbol": "EURUSD", "type": 0, "volume": 1, "price_open": 1, "price_current": 1, "profit": 0}]
        tracker.aggregate(positions, agents, {"EURUSD": {"bid": 1.0, "ask": 1.0, "time_msc": 1000}}, {"EURUSD": 0.0001}, 1000, 1000, now=1)
        second = tracker.aggregate([{**positions[0], "profit": 10, "price_current": 1.001}], agents, {"EURUSD": {"bid": 1.001, "ask": 1.001, "time_msc": 2000}}, {"EURUSD": 0.0001}, 1000, 1000, now=2)
        self.assertGreater(second[0]["pnlVelocity"], 0)
        self.assertGreater(second[0]["marketVelocity"], 0)

    def test_aggregate_includes_position_rows_per_bot(self):
        tracker = TelemetryTracker(alpha=1)
        agents = [
            {"id": "one", "name": "EA One", "magic": 101},
            {"id": "two", "name": "EA Two", "magic": 202},
            {"id": "three", "name": "EA Three", "magic": 303},
            {"id": "four", "name": "EA Four", "magic": 404},
        ]
        positions = [
            {"magic": 202, "symbol": "USTEC", "type": 1, "volume": 0.6, "price_open": 30377.2, "price_current": 30305.7, "profit": 37.79, "swap": 0, "commission": 0, "ticket": 222},
            {"magic": 101, "symbol": "USTEC", "type": 0, "volume": 0.6, "price_open": 30279.5, "price_current": 30304.7, "profit": 13.32, "swap": 0, "commission": 0, "ticket": 111},
        ]
        result = tracker.aggregate(positions, agents, {}, {}, 2844.95, 2855.50, now=1, starting_balance=1350)
        one, two = result[0], result[1]
        self.assertEqual(len(one["positions"]), 1)
        self.assertEqual(one["positions"][0]["side"], "buy")
        self.assertEqual(one["positions"][0]["priceOpen"], 30279.5)
        self.assertEqual(one["positions"][0]["priceCurrent"], 30304.7)
        self.assertEqual(one["positions"][0]["profit"], 13.32)
        self.assertEqual(len(two["positions"]), 1)
        self.assertEqual(two["positions"][0]["side"], "sell")
        self.assertEqual(two["floatingReturnPct"], round(37.79 / 1350 * 100, 3))

    def test_closed_history_and_return_percentages_per_bot(self):
        tracker = TelemetryTracker(alpha=1)
        agents = [
            {"id": "one", "name": "EA One", "magic": 101},
            {"id": "two", "name": "EA Two", "magic": 202},
            {"id": "three", "name": "EA Three", "magic": 303},
            {"id": "four", "name": "EA Four", "magic": 404},
        ]
        history = [
            {"magic": 101, "type": 0, "profit": 50, "swap": 2, "commission": -2},
            {"magic": 101, "type": 1, "profit": 30, "swap": 0, "commission": 0},
            {"magic": 202, "type": 0, "profit": -20, "swap": 0, "commission": 0},
            {"magic": 999, "type": 0, "profit": 500, "swap": 0, "commission": 0},
            {"magic": 101, "type": 2, "profit": 9999, "swap": 0, "commission": 0},
        ]
        positions = [
            {"magic": 101, "symbol": "EURUSD", "type": 0, "volume": 1, "price_open": 1.1, "price_current": 1.2, "profit": 10, "swap": 0, "commission": 0},
        ]
        result = tracker.aggregate(positions, agents, {}, {}, 1000, 1010, now=1, history=history, starting_balance=1000)
        one, two = result[0], result[1]
        self.assertEqual(one["closedPnl"], 80.0)
        self.assertEqual(one["floatingReturnPct"], 1.0)
        self.assertEqual(one["closedReturnPct"], 8.0)
        self.assertEqual(one["totalReturnPct"], 9.0)
        self.assertEqual(two["closedPnl"], -20.0)
        self.assertEqual(two["totalReturnPct"], -2.0)
        self.assertEqual(result[2]["closedPnl"], 0.0)
        self.assertEqual(result[3]["closedPnl"], 0.0)

    def test_currency_rate_scales_closed_pnl_only_for_display(self):
        tracker = TelemetryTracker(alpha=1)
        agents = [
            {"id": "one", "name": "EA One", "magic": 101},
            {"id": "two", "name": "EA Two", "magic": 202},
            {"id": "three", "name": "EA Three", "magic": 303},
            {"id": "four", "name": "EA Four", "magic": 404},
        ]
        history = [{"magic": 101, "type": 0, "profit": 100, "swap": 0, "commission": 0}]
        result = tracker.aggregate([], agents, {}, {}, 1000, 1000, now=1, history=history, currency_rate=0.5, starting_balance=1000)
        self.assertEqual(result[0]["closedPnl"], 50.0)
        self.assertEqual(result[0]["closedReturnPct"], 5.0)


if __name__ == "__main__":
    unittest.main()
