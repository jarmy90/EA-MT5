import unittest

from mt5_bridge.telemetry import TelemetryTracker, position_pnl, position_state


class TelemetryTests(unittest.TestCase):
    def test_pnl_aggregates_profit_swap_and_commission(self):
        self.assertEqual(position_pnl({"profit": 10, "swap": -2, "commission": -1}), 7)

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


if __name__ == "__main__":
    unittest.main()
