from datetime import timedelta
from uuid import uuid4

from app.api.responses.api import ApiResponse
from app.api.requests.typing import CreateTypingTestRequest, GetTypingTestRequest
from app.api.responses.typing import TypingTestResponse
from app.models.errors import TypingTestError
from app.services.device_service import DeviceService

from app.core.clock import utc_now
from app.models.typing_stat import TypingStat
from app.models.typing_test import TypingTest
from app.repositories.device_repository import PostgresDeviceRepository
from app.repositories.memory_device_repository import MemoryDeviceRepository
from app.repositories.memory_typing_test_repository import MemoryTypingTestRepository
from app.repositories.typing_test_repository import PostgresTypingTestRepository
from app.services.prompt_service import PromptService
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
        with self.test_repository.transaction() as storage:
            storage.delete_before((now - timedelta(days=1)).isoformat())
            if isinstance(self.test_repository, MemoryTypingTestRepository) and storage.count() >= 2000:
                raise TypingTestError("capacity_reached")
            storage.save(test)
        return self._response(test, now, request.word_by_word)

    def get(self, request: GetTypingTestRequest) -> ApiResponse[TypingTestResponse]:
        now = utc_now()
        live = self.live_tests.get(str(request.test_id))
        if live is not None:
            return self._response(live, now, request.word_by_word)
        with self.test_repository.transaction() as storage:
            test = self._require_test(storage, str(request.test_id))
            update_test(test, test.typed, test.revision, elapsed(test, now) >= test.duration, now)
            storage.save(test)
        if request.device_id:
            self._record_result(test, str(request.device_id), now.isoformat())
        return self._response(test, now, request.word_by_word)

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
    ) -> None:
        with self.device_repository.transaction() as storage:
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
                )
            )
