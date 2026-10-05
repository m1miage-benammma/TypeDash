from dataclasses import dataclass


@dataclass(frozen=True)
class TypingStat:
    id: str
    device_id: str
    source_test_id: str
    difficulty: str
    language: str
    duration: int
    punctuation: bool
    numbers: bool
    wpm: float
    accuracy: float
    correct_characters: int
    incorrect_characters: int
    typed_characters: int
    completed_words: int
    elapsed_seconds: float
    finished_at: str
    created_at: str

