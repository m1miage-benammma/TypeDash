from datetime import timedelta
from copy import deepcopy
from threading import Lock
from time import monotonic
from uuid import uuid4
from typing import Callable

from app.api.responses.api import ApiResponse
from app.api.requests.typing import (
    CreateTypingTestRequest, GetTypingTestRequest, TypingBatchRequest, TypingDurationRequest,
)
from app.api.responses.typing import TypingTestResponse
from app.models.enums import SessionStatus
from app.models.errors import TypingTestError
from app.services.device_service import DeviceService

from app.core.clock import utc_now
from app.core.security_context import device_context
from app.models.typing_stat import TypingStat
from app.models.typing_test import TypingTest
from app.ports.device_repository import DeviceRepository
from app.ports.typing_test_repository import TypingTestRepository, TypingTestStorage
from app.services.prompt_service import PromptService
from app.services.typing_engine import elapsed, snapshot, update_test
from app.services.typing_input import apply_input
from app.services.typing_view import typing_view



class TypingService:
    def __init__(
        self,
        test_repository: TypingTestRepository,
        device_repository: DeviceRepository,
        prompts: PromptService,
        capacity_check: Callable[[TypingTestStorage], bool] | None = None,
    ):
        self.test_repository = test_repository
        self.device_repository = device_repository
        self.prompts = prompts
        self.capacity_check = capacity_check
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
            owner_device_id=device_context.get() or None,
        )
        with self._cleanup_lock:
            cleanup_due = monotonic() >= self._next_cleanup
            if cleanup_due:
                self._next_cleanup = monotonic() + 300
        try:
            with self.test_repository.transaction() as storage:
                if cleanup_due:
                    storage.delete_before((now - timedelta(days=1)).isoformat())
                if self.capacity_check and not self.capacity_check(storage):
                    raise TypingTestError("capacity_reached")
                storage.save(test)
        except Exception:
            if cleanup_due:
                with self._cleanup_lock:
                    self._next_cleanup = 0.0
            raise
        return self._response(test, now, request.word_by_word, include_words=not request.compact)

    def get(self, request: GetTypingTestRequest) -> ApiResponse[TypingTestResponse]:
        now = utc_now()
        with self.test_repository.transaction() as storage:
            test = self._require_test(storage, str(request.test_id))
            before = (test.revision, test.status, test.active_seconds, test.result is not None)
            update_test(test, test.typed, test.revision, elapsed(test, now) >= test.duration, now)
            # Plain reads skip the write unless the clock actually changed the state.
            if before != (test.revision, test.status, test.active_seconds, test.result is not None):
                storage.save(test)
            if request.device_id and test.result:
                self._record_result(test, str(request.device_id), now.isoformat(), test_storage=storage)
        return self._response(test, now, request.word_by_word, include_words=not request.compact)

    def apply_inputs(self, test_id: str, batch: TypingBatchRequest) -> dict:
        """Apply a key batch in one transaction; the database is the shared state."""
        device_id = device_context.get()
        if str(batch.device_id) != device_id:
            raise TypingTestError("device_mismatch")
        now = utc_now()
        with self.test_repository.transaction() as storage:
            test = self._require_test(storage, test_id)
            for entry in batch.inputs:
                apply_input(test, entry.key, entry.sequence, entry.word_by_word, now)
            storage.save(test)
            if test.result:
                self._record_result(test, device_id, now.isoformat(), test_storage=storage)
        return self._frame(test, now, batch.inputs[-1].word_by_word)

    def change_duration(self, test_id: str, request: TypingDurationRequest) -> dict:
        if str(request.device_id) != device_context.get():
            raise TypingTestError("device_mismatch")
        now = utc_now()
        with self.test_repository.transaction() as storage:
            test = self._require_test(storage, test_id)
            if test.status != SessionStatus.READY or test.typed:
                raise TypingTestError("not_configurable")
            test.duration = self._duration(request.duration)
            storage.save(test)
        return self._frame(test, now, False, include_duration=True)

    def _frame(self, test: TypingTest, now, word_by_word: bool, *, include_duration=False) -> dict:
        # Static prompt/options are sent once by prepare; frames carry state only.
        excluded = {"text": True, "punctuation": True, "numbers": True, "difficulty": True,
                    "language": True, "duration": True, "view": {"words": True}}
        if include_duration:
            excluded.pop("duration")
        return self._response(test, now, word_by_word, include_words=False).model_dump(
            mode="json", exclude={"data": excluded})

    @staticmethod
    def _require_test(storage, test_id: str) -> TypingTest:
        test = storage.find(test_id)
        if test is None:
            raise TypingTestError("not_found")
        TypingService.require_owner(test)
        return test

    @staticmethod
    def require_owner(test: TypingTest) -> None:
        if test.owner_device_id != (device_context.get() or None):
            raise TypingTestError("not_found")

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
        with self.device_repository.transaction(test_storage) as storage:
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
