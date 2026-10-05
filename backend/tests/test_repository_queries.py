from datetime import datetime, timezone
from decimal import Decimal
from unittest import TestCase
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

from psycopg.rows import dict_row

from app.api.requests.device import DeviceRequest
from app.api.requests.typing import CreateTypingTestRequest
from app.core.config import Settings
from app.core.postgres import PostgresDatabase, connection_options
from app.models.device import Device
from app.models.typing_stat import TypingStat
from app.repositories.device_repository import PostgresDeviceRepository, PostgresDeviceSession
from app.repositories.typing_test_repository import PostgresTypingTestRepository
from app.repositories.memory_device_repository import MemoryDeviceRepository
from app.repositories.memory_typing_test_repository import MemoryTypingTestRepository
from app.services.device_service import DeviceService
from app.services.prompt_service import PromptService
from app.services.typing_service import TypingService


class RepositoryQueryTests(TestCase):
    def test_one_bounded_pool_is_shared_and_closed(self):
        settings = Settings(storage="memory", database_url="postgresql://localhost/test", _env_file=None)
        with patch("psycopg_pool.ConnectionPool") as factory:
            database = PostgresDatabase(settings)
            options = factory.call_args.kwargs
            self.assertFalse(options["open"])
            self.assertEqual(options["max_size"], 4)
            self.assertEqual(options["min_size"], 1)
            self.assertIs(options["kwargs"]["row_factory"], dict_row)
            database.open()
            with PostgresDeviceRepository(database).transaction():
                pass
            with PostgresTypingTestRepository(database).transaction():
                pass
            self.assertEqual(factory.return_value.connection.call_count, 2)
            database.close()
            factory.return_value.close.assert_called_once()

    def test_each_schema_initializes_with_one_execute(self):
        for repository_type in (PostgresDeviceRepository, PostgresTypingTestRepository):
            with self.subTest(repository=repository_type):
                connection = MagicMock()
                database = Mock()
                database.connection.return_value = connection
                connection.__enter__.return_value = connection
                repository_type(database).initialize()
                connection.execute.assert_called_once()
                self.assertIn("ENABLE ROW LEVEL SECURITY", connection.execute.call_args.args[0])

    def test_connections_use_named_rows_without_prepared_statements(self):
        options = connection_options(Settings(
            storage="memory", database_url="postgresql://localhost/test", _env_file=None,
        ))
        self.assertIs(options["row_factory"], dict_row)
        self.assertIsNone(options["prepare_threshold"])

    def test_paginated_history_is_ordered_and_parameterized(self):
        connection = Mock()
        connection.execute.return_value.fetchall.return_value = []
        device_id = uuid4()
        session = PostgresDeviceSession(connection)
        self.assertEqual(session.list_stats(str(device_id), limit=15, offset=30), [])
        query, params = connection.execute.call_args.args
        self.assertIn("ORDER BY finished_at DESC, id DESC LIMIT %s OFFSET %s", query)
        self.assertEqual(params, (device_id, 15, 30))

    def test_summary_aggregates_all_history_without_a_page_limit(self):
        connection = Mock()
        connection.execute.return_value.fetchone.return_value = {
            "sessions": 41, "best_wpm": Decimal("90.5"),
            "average_wpm": Decimal("51.7"), "average_accuracy": Decimal("97.1"),
        }
        summary = PostgresDeviceSession(connection).stats_summary(str(uuid4()))
        self.assertEqual(summary.sessions, 41)
        self.assertEqual(summary.average_wpm, 51.7)
        query, params = connection.execute.call_args.args
        self.assertNotIn("LIMIT", query)
        self.assertIn("AVG(wpm)", query)
        self.assertEqual(len(params), 1)

    def test_named_stat_mapping_ignores_dictionary_order(self):
        now = datetime.now(timezone.utc)
        row = {
            "created_at": now, "finished_at": now, "id": uuid4(),
            "device_id": uuid4(), "source_test_id": uuid4(), "difficulty": "easy",
            "language": "fr", "duration_seconds": 30, "punctuation": False,
            "numbers": False, "wpm": Decimal("50.4"), "accuracy": Decimal("99.2"),
            "correct_characters": 126, "incorrect_characters": 1,
            "typed_characters": 127, "completed_words": 23,
            "elapsed_seconds": Decimal("30"),
        }
        stat = PostgresDeviceSession._stat_from_row(row)
        self.assertEqual(stat.wpm, 50.4)
        self.assertEqual(stat.duration, 30)
        self.assertEqual(stat.samples, [])
        self.assertEqual(stat.finished_at, now.isoformat())

    def test_profile_has_30_recent_rows_but_averages_every_session(self):
        repository = MemoryDeviceRepository()
        device_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        repository.save_device(Device(device_id, None, now, now))
        for i in range(41):
            repository.save_stat(TypingStat(
                id=str(uuid4()), device_id=device_id, source_test_id=str(uuid4()),
                difficulty="easy", language="en", duration=30, punctuation=False,
                numbers=False, wpm=float(i), accuracy=100,
                correct_characters=10, incorrect_characters=0, typed_characters=10,
                completed_words=2, elapsed_seconds=30, finished_at=now, created_at=now,
            ))
        profile = DeviceService(repository).profile(DeviceRequest(device_id=device_id)).data
        self.assertEqual(len(profile.stats), 30)
        self.assertEqual(profile.summary.sessions, 41)
        self.assertEqual(profile.summary.average_wpm, 20)
        self.assertEqual(profile.summary.best_wpm, 40)
        first = repository.list_stats(device_id, 15, 0)
        second = repository.list_stats(device_id, 15, 15)
        self.assertEqual(len({stat.id for stat in first + second}), 30)

    def test_compact_prepare_keeps_prompt_and_removes_character_payload(self):
        prompts = PromptService()
        prompts.generate = Mock(return_value=" ".join(["bonjour"] * 160))
        service = TypingService(MemoryTypingTestRepository(), MemoryDeviceRepository(), prompts)
        full = service.prepare(CreateTypingTestRequest(language="fr")).data
        compact = service.prepare(CreateTypingTestRequest(language="fr", compact=True)).data
        self.assertEqual(compact.text, full.text)
        self.assertEqual(compact.language, "fr")
        self.assertEqual(compact.view.words, [])
        self.assertLess(len(compact.model_dump_json()), len(full.model_dump_json()) / 10)
