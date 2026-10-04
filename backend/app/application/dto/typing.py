from dataclasses import dataclass

from app.domain.enums.typing import Difficulty, Language


@dataclass(frozen=True)
class CreateTypingTestCommand:
    difficulty: Difficulty
    language: Language
    duration: int
    punctuation: bool = False
    numbers: bool = False


@dataclass(frozen=True)
class UpdateTypingTestCommand:
    test_id: str
    device_id: str
    typed: str
    revision: int
    finish: bool = False
