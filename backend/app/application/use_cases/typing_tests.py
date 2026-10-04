from uuid import uuid4

from app.application.dto.typing import CreateTypingTestCommand, UpdateTypingTestCommand
from app.domain.entities.typing_test import TypingTest, utc_now
from app.domain.ports.typing import PromptSource, TestRepository


class TypingTests:
    def __init__(self, repository: TestRepository, prompts: PromptSource):
        self.repository, self.prompts = repository, prompts

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

    def get(self, test_id):
        now = utc_now()
        def refresh(test):
            test.update(test.typed, test.revision, False, now)
        return self.repository.change(test_id, refresh).view(now)

    def progress(self, command: UpdateTypingTestCommand):
        now = utc_now()
        return self.repository.change(
            command.test_id,
            lambda test: test.update(command.typed, command.revision, command.finish, now),
        ).view(now)
