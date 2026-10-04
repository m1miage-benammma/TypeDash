from typing import Callable, Protocol

from app.domain.entities.typing_test import TypingTest
from app.domain.enums.typing import Difficulty, Language


class TestRepository(Protocol):
    def create(self, test: TypingTest) -> None: ...
    def change(self, test_id: str, operation: Callable[[TypingTest], None]) -> TypingTest: ...


class PromptSource(Protocol):
    def generate(
        self,
        difficulty: Difficulty,
        language: Language,
        duration: int,
        punctuation: bool = False,
        numbers: bool = False,
    ) -> str: ...
