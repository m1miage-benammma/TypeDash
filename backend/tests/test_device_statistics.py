import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from app.api.requests.device import DeviceRequest
from app.models.typing_stat import TypingStat
from app.repositories.memory_device_repository import MemoryDeviceRepository

with patch.dict(os.environ, {"TYPEDASH_STORAGE": "memory", "TYPEDASH_RUNTIME_ENVIRONMENT": "development"}):
    from app.services.device_service import DeviceService


class DeviceStatisticsTests(unittest.TestCase):
    def setUp(self):
        self.repository = MemoryDeviceRepository()
        self.service = DeviceService(self.repository)
        self.device_id = str(uuid4())
        self.now = datetime.now(timezone.utc)
        self.service.touch(self.repository, self.device_id, self.now.isoformat())

    def add_session(self, wpm, index=0, device_id=None):
        test_id = str(uuid4())
        timestamp = (self.now + timedelta(seconds=index)).isoformat()
        self.repository.save_stat(TypingStat(
            id=str(uuid4()), device_id=device_id or self.device_id, source_test_id=test_id,
            difficulty="easy", language="en", duration=30, punctuation=False,
            numbers=False, wpm=wpm, accuracy=99.2, correct_characters=126,
            incorrect_characters=1, typed_characters=127, completed_words=25,
            elapsed_seconds=30, finished_at=timestamp, created_at=timestamp,
        ))

    def profile(self):
        return self.service.profile(DeviceRequest(device_id=self.device_id)).data

    def test_single_session_preserves_decimal_best_and_average(self):
        self.add_session(50.4)
        summary = self.profile().summary
        self.assertEqual(summary.sessions, 1)
        self.assertEqual(summary.best_wpm, 50.4)
        self.assertEqual(summary.average_wpm, 50.4)

    def test_average_is_sum_of_session_speeds_divided_by_session_count(self):
        speeds = [50.4, 30.2, 70.6]
        for index, speed in enumerate(speeds):
            self.add_session(speed, index)
        summary = self.profile().summary
        self.assertEqual(summary.sessions, len(speeds))
        self.assertEqual(summary.average_wpm, round(sum(speeds) / len(speeds), 1))
        self.assertEqual(summary.best_wpm, max(speeds))

    def test_summary_uses_all_sessions_not_only_thirty_visible_entries(self):
        speeds = [100.4] + [20.2] * 34
        for index, speed in enumerate(speeds):
            self.add_session(speed, index)
        self.add_session(999, device_id=str(uuid4()))
        profile = self.profile()
        self.assertEqual(len(profile.stats), 30)
        self.assertEqual(profile.summary.sessions, 35)
        self.assertEqual(profile.summary.best_wpm, 100.4)
        self.assertEqual(profile.summary.average_wpm, round(sum(speeds) / len(speeds), 1))

    def test_empty_and_cleared_history_have_zero_summary(self):
        self.assertEqual(self.profile().summary.sessions, 0)
        self.add_session(50.4)
        profile = self.service.clear_stats(DeviceRequest(device_id=self.device_id)).data
        self.assertEqual(profile.summary.sessions, 0)
        self.assertEqual(profile.summary.best_wpm, 0.0)
        self.assertEqual(profile.summary.average_wpm, 0.0)
