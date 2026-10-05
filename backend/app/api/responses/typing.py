from pydantic import BaseModel

from app.models.enums import Difficulty, Language, SessionStatus


class TypingMetricsResponse(BaseModel):
    wpm: float
    accuracy: float
    correct_characters: int
    incorrect_characters: int
    typed_characters: int
    completed_words: int
    elapsed_seconds: float


class SpeedSampleResponse(BaseModel):
    second: float
    wpm: float


class TypingResultResponse(TypingMetricsResponse):
    finished_at: str
    samples: list[SpeedSampleResponse]


class TypingTestResponse(BaseModel):
    id: str
    punctuation: bool
    numbers: bool
    difficulty: Difficulty
    language: Language
    duration: int
    text: str
    status: SessionStatus
    started_at: str | None
    typed: str
    revision: int
    observed_at: str
    remaining_seconds: float
    pause_after_seconds: float
    result: TypingResultResponse | None
    view: 'TypingViewResponse'
    auto_inserted_separator: bool = False
    input_word_by_word: bool = False


class PromptCharacterResponse(BaseModel):
    index: int
    value: str
    current: bool
    correct: bool
    incorrect: bool
    space: bool


class PromptWordResponse(BaseModel):
    index: int
    chars: list[PromptCharacterResponse]


class ChartSampleResponse(SpeedSampleResponse):
    height_percent: float


class TypingViewResponse(BaseModel):
    words: list[PromptWordResponse]
    active: bool
    can_type: bool
    can_configure: bool
    custom_duration: bool
    durations: list[int]
    result_chart: list[ChartSampleResponse]
