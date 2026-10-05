import unittest
from unittest.mock import patch
from uuid import UUID

from app.api.requests.typing import CreateTypingTestRequest, GetTypingTestRequest
from app.repositories.memory_device_repository import MemoryDeviceRepository
from app.repositories.memory_typing_test_repository import MemoryTypingTestRepository
from app.services.prepared_test_cache import PreparedTestCache
from app.services.prompt_service import PromptService
from app.services.typing_service import TypingService
from app.services.typing_stream_service import TypingStreamService


class TrackingRepository(MemoryTypingTestRepository):
    def __init__(self):
        super().__init__()
        self.cleanups = 0
        self.reads = 0

    def delete_before(self, cutoff):
        self.cleanups += 1
        super().delete_before(cutoff)

    def find(self, test_id):
        self.reads += 1
        return super().find(test_id)


class PreparePerformanceTests(unittest.TestCase):
    def setUp(self):
        self.repository = TrackingRepository()
        self.service = TypingService(self.repository, MemoryDeviceRepository(), PromptService())

    def test_ready_handoff_avoids_database_read_but_is_durable(self):
        prepared = self.service.prepare(CreateTypingTestRequest(language="fr")).data
        self.assertIn(str(prepared.id), self.repository.tests)
        stream = TypingStreamService(self.service)
        request = GetTypingTestRequest(test_id=UUID(str(prepared.id)))
        first = stream._load(request)
        self.assertEqual(self.repository.reads, 0)
        self.assertEqual(first.text, prepared.text)
        first.typed = "changed"
        restored = stream._load(request)
        self.assertEqual(self.repository.reads, 1)
        self.assertEqual(restored.typed, "")

    def test_cleanup_is_throttled_without_skipping_session_saves(self):
        with patch("app.services.typing_service.monotonic", return_value=1000):
            for duration in (15, 30, 60):
                self.service.prepare(CreateTypingTestRequest(duration=duration))
        self.assertEqual(self.repository.cleanups, 1)
        self.assertEqual(len(self.repository.tests), 3)
        with patch("app.services.typing_service.monotonic", return_value=1301):
            self.service.prepare(CreateTypingTestRequest())
        self.assertEqual(self.repository.cleanups, 2)

    def test_cache_is_bounded_expiring_and_single_use(self):
        clock = [0]
        cache = PreparedTestCache(capacity=1, ttl=5, clock=lambda: clock[0])
        first = self.service.prepare(CreateTypingTestRequest()).data
        second = self.service.prepare(CreateTypingTestRequest()).data
        cache.put(first)
        cache.put(second)
        self.assertIsNone(cache.take(first.id))
        self.assertEqual(cache.take(second.id).text, second.text)
        self.assertIsNone(cache.take(second.id))
        cache.put(first)
        clock[0] = 6
        self.assertIsNone(cache.take(first.id))


if __name__ == "__main__":
    unittest.main()
