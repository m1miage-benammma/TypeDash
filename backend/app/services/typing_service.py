from datetime import timedelta
from copy import deepcopy
from threading import Lock
from time import monotonic
from uuid import uuid4

from app.api.responses.api import ApiResponse
from app.api.requests.typing import CreateTypingTestRequest, GetTypingTestRequest
from app.api.responses.typing import TypingTestResponse
from app.models.errors import TypingTestError
from app.services.device_service import DeviceService

from app.core.clock import utc_now
from app.models.typing_stat import TypingStat
from app.models.typing_test import TypingTest
from app.repositories.device_repository import PostgresDeviceRepository, PostgresDeviceSession
from app.repositories.memory_device_repository import MemoryDeviceRepository
from app.repositories.memory_typing_test_repository import MemoryTypingTestRepository
from app.repositories.typing_test_repository import PostgresTypingTestRepository
from app.services.prompt_service import PromptService
from app.services.prepared_test_cache import PreparedTestCache
from app.services.typing_engine import elapsed, snapshot, update_test
from app.services.typing_view import typing_view

TypingTestRepository = MemoryTypingTestRepository | PostgresTypingTestRepository
DeviceRepository = MemoryDeviceRepository | PostgresDeviceRepository


class TypingService:
    def __init__(
        self,
        test_repository: TypingTestRepository,
        device_repository: DeviceRepository,
        prompts: PromptService,
    ):
        self.test_repository = test_repository
        self.device_repository = device_repository
        self.prompts = prompts
        self.live_tests: dict[str, TypingTest | None] = {}
        self.prepared_tests = PreparedTestCache()
        self._cleanup_lock = Lock()
        self._next_cleanup = 0.0

    def prepare(self, request: CreateTypingTestRequest) -> ApiResponse[TypingTestResponse]:
        now = utc_now()
        duration = self._duration(request.duration)
        test = TypingTest(
            id=str(uuid4()), difficulty=request.difficulty, language=request.language,
            duration=duration, punctuation=request.punctuation, numbers=request.numbers,
            text=self.prompts.generate(
                request.difficulty, request.language, duration,
                request.punctuation, request.numbers,
            ),
            created_at=now.isoformat(),
        )
        with self._cleanup_lock:
            cleanup_due = monotonic() >= self._next_cleanup
            if cleanup_due:
                self._next_cleanup = monotonic() + 300
        try:
            with self.test_repository.transaction() as storage:
                if cleanup_due:
                    storage.delete_before((now - timedelta(days=1)).isoformat())
                if isinstance(self.test_repository, MemoryTypingTestRepository) and storage.count() >= 2000:
                    raise TypingTestError("capacity_reached")
                storage.save(test)
        except Exception:
            if cleanup_due:
                with self._cleanup_lock:
                    self._next_cleanup = 0.0
            raise
        # Persistence remains mandatory before responding. The following
        # WebSocket need not open another DB connection to read this same row.
        self.prepared_tests.put(test)
        return self._response(test, now, request.word_by_word, include_words=not request.compact)

    def get(self, request: GetTypingTestRequest) -> ApiResponse[TypingTestResponse]:
        now = utc_now()
        live = self.live_tests.get(str(request.test_id))
        if live is not None:
            return self._response(live, now, request.word_by_word, include_words=not request.compact)
        with self.test_repository.transaction() as storage:
            test = self._require_test(storage, str(request.test_id))
            update_test(test, test.typed, test.revision, elapsed(test, now) >= test.duration, now)
            storage.save(test)
            if request.device_id:
                self._record_result(test, str(request.device_id), now.isoformat(), test_storage=storage)
        return self._response(test, now, request.word_by_word)

    def persist(self, test: TypingTest, device_id: str) -> None:
        # In Postgres, the test and durable statistics commit together. A final
        # frame is sent only after this transaction succeeds.
        with self.test_repository.transaction() as storage:
            storage.save(test)
            if test.result:
                self._record_result(test, device_id, utc_now().isoformat(), test_storage=storage)

    @staticmethod
    def _require_test(storage, test_id: str) -> TypingTest:
        test = storage.find(test_id)
        if test is None:
            raise TypingTestError("not_found")
        return test

    @staticmethod
    def _response(test: TypingTest, now, word_by_word: bool = False, *, include_words: bool = True) -> ApiResponse[TypingTestResponse]:
        return ApiResponse[TypingTestResponse](
            data=TypingTestResponse.model_validate({
                **snapshot(test, now), "view": typing_view(test, word_by_word, include_words=include_words),
            }),
        )

    @staticmethod
    def _duration(value: int | str) -> int:
        if isinstance(value, str) and (not value.isascii() or not value.isdigit()):
            raise TypingTestError("duration_invalid")
        if isinstance(value, str):
            value = value.lstrip("0") or "0"
            if len(value) > 3:
                raise TypingTestError("duration_max")
        duration = int(value)
        if duration > 300:
            raise TypingTestError("duration_max")
        if duration < 1:
            raise TypingTestError("duration_invalid")
        return duration

    def _record_result(
        self,
        test: TypingTest,
        device_id: str,
        created_at: str,
        *, test_storage=None,
    ) -> None:
        if isinstance(self.device_repository, PostgresDeviceRepository) and hasattr(test_storage, "connection"):
            self._save_result(PostgresDeviceSession(test_storage.connection), test, device_id, created_at)
            return
        with self.device_repository.transaction() as storage:
            self._save_result(storage, test, device_id, created_at)

    @staticmethod
    def _save_result(storage, test: TypingTest, device_id: str, created_at: str) -> None:
        DeviceService.touch(storage, device_id, created_at)
        if not test.result or storage.has_stat(test.id):
            return
        result = test.result
        storage.save_stat(
            TypingStat(
                id=str(uuid4()),
                device_id=device_id,
                source_test_id=test.id,
                difficulty=str(test.difficulty),
                language=str(test.language),
                duration=test.duration,
                punctuation=test.punctuation,
                numbers=test.numbers,
                wpm=result["wpm"],
                accuracy=result["accuracy"],
                correct_characters=result["correct_characters"],
                incorrect_characters=result["incorrect_characters"],
                typed_characters=result["typed_characters"],
                completed_words=result["completed_words"],
                elapsed_seconds=result["elapsed_seconds"],
                finished_at=result["finished_at"],
                created_at=created_at,
                samples=deepcopy(result["samples"]),
            )
        )
