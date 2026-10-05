from copy import deepcopy
from types import SimpleNamespace
import unittest

from app.services.typing_view import typing_view


class SessionChartTests(unittest.TestCase):
    def view(self, result):
        test = SimpleNamespace(result=result, status="finished" if result else "ready", duration=30)
        return typing_view(test, False, include_words=False)["result_chart"]

    def test_chart_is_empty_until_session_finishes(self):
        self.assertEqual(self.view(None), [])

    def test_final_point_uses_actual_duration_and_score_without_mutating_samples(self):
        result = {"elapsed_seconds": 30.0, "wpm": 50.4,
                  "samples": [{"second": 1.0, "wpm": 60.0}, {"second": 29.0, "wpm": 51.0}]}
        original = deepcopy(result)
        chart = self.view(result)
        self.assertEqual(chart[-1]["second"], 30.0)
        self.assertEqual(chart[-1]["wpm"], 50.4)
        self.assertEqual(result, original)
        self.assertAlmostEqual(chart[-1]["height_percent"], 84.0)

    def test_short_session_still_has_one_real_final_point(self):
        chart = self.view({"elapsed_seconds": .5, "wpm": 12.0, "samples": []})
        self.assertEqual(len(chart), 1)
        self.assertEqual(chart[0]["second"], .5)
        self.assertEqual(chart[0]["wpm"], 12.0)

    def test_same_timestamp_is_not_duplicated_and_zero_score_is_on_zero_axis(self):
        result = {"elapsed_seconds": 1.0, "wpm": 0.0,
                  "samples": [{"second": 1.0, "wpm": 12.0}]}
        chart = self.view(result)
        self.assertEqual(len(chart), 1)
        self.assertEqual(chart[0]["height_percent"], 0.0)
        self.assertEqual(result["samples"][0]["wpm"], 12.0)
