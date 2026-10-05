from dataclasses import dataclass, field

from app.models.enums import Difficulty, Language, SessionStatus


@dataclass
class TypingTest:
    id: str
    difficulty: Difficulty
    language: Language
    duration: int
    text: str
    created_at: str
    status: SessionStatus = SessionStatus.READY
    started_at: str | None = None
    typed: str = ""
    revision: int = -1
    result: dict | None = None
    samples: list[dict] = field(default_factory=list)
    punctuation: bool = False
    numbers: bool = False
    active_seconds: float = 0.0
    last_activity_at: str | None = None
    auto_inserted_separator: bool = False
    input_word_by_word: bool = False
