from uuid import uuid4

from app.application.dto.typing import CreateTypingTestCommand, UpdateTypingTestCommand
from app.domain.entities.identity import TypingStat
from app.domain.entities.typing_test import TypingTest, utc_now
from app.domain.ports.identity import IdentityRepository
from app.domain.ports.typing import PromptSource, TestRepository


class TypingTests:
    def __init__(
        self,
        repository: TestRepository,
        prompts: PromptSource,
        identities: IdentityRepository,
    ):
        self.repository = repository
        self.prompts = prompts
        self.identities = identities

    def prepare(self, command: CreateTypingTestCommand):
        test = TypingTest(
            id=str(uuid4()), difficulty=command.difficulty, language=command.language,
            duration=command.duration, punctuation=command.punctuation, numbers=command.numbers,
            text=self.prompts.generate(
                command.difficulty,
                command.language,
                command.duration,
                command.punctuation,
                command.numbers,
            ),
            created_at=utc_now().isoformat(),
        )
        self.repository.create(test)
        return test.view(utc_now())

    def get(self, test_id: str, device_id: str | None = None):
        now = utc_now()
        def refresh(test):
            test.update(test.typed, test.revision, False, now)
        test = self.repository.change(test_id, refresh)
        if device_id:
            self.identities.touch_device(device_id, now.isoformat())
            self._record_result(test, device_id, now.isoformat())
        return test.view(now)

    def progress(self, command: UpdateTypingTestCommand):
        now = utc_now()
        self.identities.touch_device(command.device_id, now.isoformat())
        test = self.repository.change(
            command.test_id,
            lambda test: test.update(command.typed, command.revision, command.finish, now),
        )
        self._record_result(test, command.device_id, now.isoformat())
        return test.view(now)

    def _record_result(self, test: TypingTest, device_id: str, created_at: str) -> None:
        if not test.result:
            return
        result = test.result
        self.identities.save_stat(TypingStat(
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
        ))
