from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums.typing import Difficulty, Language, SessionStatus


class CreateTypingTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    punctuation: bool = False
    numbers: bool = False
    difficulty: Difficulty = Difficulty.EASY
    language: Language = Language.EN
    duration: int = Field(default=30, ge=1, le=300, strict=True)


class TypingProgressRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    typed: str = Field(default="", max_length=100000)
    revision: int = Field(ge=0, le=1000000)


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
    remaining_seconds: float
    pause_after_seconds: float
    idle_timeout_seconds: float
    metrics: TypingMetricsResponse
    result: TypingResultResponse | None
