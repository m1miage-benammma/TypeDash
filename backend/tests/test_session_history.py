from dataclasses import replace
from copy import deepcopy
from datetime import datetime, timezone
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from app.api.requests.session import SessionRequest
from app.api.requests.typing import CreateTypingTestRequest, GetTypingTestRequest
from app.models.errors import TypingTestError
from app.repositories.memory_device_repository import MemoryDeviceRepository
from app.repositories.memory_typing_test_repository import MemoryTypingTestRepository
from app.repositories.device_repository import PostgresDeviceRepository, PostgresDeviceSession
from app.repositories.typing_test_repository import PostgresTypingTestRepository
from app.services.session_service import SessionService
from app.services.typing_service import TypingService


class SessionHistoryTests(unittest.TestCase):
    def setUp(self):
        self.devices = MemoryDeviceRepository()
        self.tests = MemoryTypingTestRepository()
        self.typing = TypingService(self.tests, self.devices, Mock(generate=Mock(return_value="hello")))
        self.device = str(uuid4())
        self.test_id = self.typing.prepare(CreateTypingTestRequest(duration=30)).data.id
        self.test = self.tests.find(self.test_id)
        self.test.status = "finished"
        self.test.typed = "hello"
        self.test.result = {
            "wpm": 60.4, "accuracy": 100, "correct_characters": 5,
            "incorrect_characters": 0, "typed_characters": 5, "completed_words": 1,
            "elapsed_seconds": 2.4, "finished_at": datetime.now(timezone.utc).isoformat(),
            "samples": [{"second": 1, "wpm": 70.2}, {"second": 2, "wpm": 62.1}],
        }

    def save(self):
        self.typing.persist(self.test, self.device)
        stat = self.devices.stats[self.test_id]
        return SessionRequest(device_id=self.device, stat_id=stat.id)

    def test_details_survive_temporary_test_cleanup_and_service_restart(self):
        request = self.save()
        self.tests.tests.clear()
        response = SessionService(self.devices).get(request).data
        self.assertEqual(response.result.wpm, 60.4)
        self.assertEqual(response.result.samples[0].wpm, 70.2)
        self.assertEqual(response.view.result_chart[-1].second, 2.4)
        self.assertEqual(response.view.result_chart[-1].wpm, response.result.wpm)

    def test_repeated_completion_does_not_duplicate_or_overwrite_samples(self):
        request = self.save()
        saved = deepcopy(self.devices.stats[self.test_id].samples)
        self.test.result["samples"][0]["wpm"] = 0
        self.typing.persist(self.test, self.device)
        self.assertEqual(len(self.devices.stats), 1)
        self.assertEqual(self.devices.find_stat(self.device, str(request.stat_id)).samples, saved)

    def test_other_device_and_unknown_stat_cannot_read_session(self):
        request = self.save()
        for device, stat in ((str(uuid4()), request.stat_id), (self.device, uuid4())):
            with self.assertRaises(TypingTestError) as error:
                SessionService(self.devices).get(SessionRequest(device_id=device, stat_id=stat))
            self.assertEqual(error.exception.code, "not_found")

    def test_clear_history_removes_durable_details(self):
        request = self.save()
        self.devices.delete_stats(self.device)
        with self.assertRaises(TypingTestError):
            SessionService(self.devices).get(request)

    def test_old_sessions_without_samples_keep_scores_without_invented_curve(self):
        request = self.save()
        stat = self.devices.stats[self.test_id]
        self.devices.stats[self.test_id] = replace(stat, samples=[])
        response = SessionService(self.devices).get(request).data
        self.assertEqual(response.result.samples, [])
        self.assertEqual(len(response.view.result_chart), 1)
        self.assertEqual(response.view.result_chart[0].wpm, stat.wpm)

    def test_persistence_failure_rolls_back_the_test_checkpoint(self):
        original = deepcopy(self.tests.find(self.test_id))
        with patch.object(self.devices, "save_stat", side_effect=RuntimeError("storage unavailable")):
            with self.assertRaises(RuntimeError):
                self.typing.persist(self.test, self.device)
        self.assertEqual(self.tests.find(self.test_id), original)
        self.assertFalse(self.devices.stats)

    def test_recovery_get_saves_result_exactly_once(self):
        self.tests.save(self.test)
        request = GetTypingTestRequest(test_id=self.test_id, device_id=self.device)
        self.typing.get(request)
        self.typing.get(request)
        self.assertEqual(len(self.devices.stats), 1)
        self.assertEqual(self.devices.stats[self.test_id].samples, self.test.result["samples"])

    def test_postgres_completion_uses_one_connection_for_both_writes(self):
        repository = Mock(spec=PostgresTypingTestRepository)
        device_repository = Mock(spec=PostgresDeviceRepository)
        storage = Mock()
        repository.transaction.return_value.__enter__ = Mock(return_value=storage)
        repository.transaction.return_value.__exit__ = Mock(return_value=False)
        service = TypingService(repository, device_repository, Mock())
        with patch.object(service, "_save_result") as save:
            service.persist(self.test, self.device)
        storage.save.assert_called_once_with(self.test)
        self.assertIs(save.call_args.args[0].connection, storage.connection)
        device_repository.transaction.assert_not_called()


class PostgresSessionStorageTests(unittest.TestCase):
    def setUp(self):
        self.connection = Mock()
        self.storage = PostgresDeviceSession(self.connection)
        self.device, self.stat_id, self.test_id = [uuid4() for _ in range(3)]
        self.row = (self.stat_id, self.device, self.test_id, "easy", "en", 30, False, False,
                    50.4, 99.2, 126, 1, 127, 25, 30, "2026-10-05T10:00:00+00:00",
                    "2026-10-05T10:00:00+00:00", [{"second": 1, "wpm": 60.4}])

    def test_detail_query_is_device_scoped_and_reads_json_samples(self):
        self.connection.execute.return_value.fetchone.return_value = self.row
        stat = self.storage.find_stat(str(self.device), str(self.stat_id))
        sql, params = self.connection.execute.call_args.args
        self.assertIn("id = %s AND device_id = %s", sql)
        self.assertEqual(params, (self.stat_id, self.device))
        self.assertEqual(stat.samples, self.row[-1])

    def test_samples_are_saved_as_jsonb_in_the_same_insert_as_scores(self):
        stat = self.storage._stat_from_row(self.row)
        self.storage.save_stat(stat)
        sql, params = self.connection.execute.call_args.args
        self.assertIn("created_at, samples", sql)
        self.assertIn("ON CONFLICT (source_test_id) DO NOTHING", sql)
        self.assertEqual(params[-1].obj, self.row[-1])
