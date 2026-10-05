from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictInt

from app.models.enums import Difficulty, Language, SessionStatus


class CreateTypingTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    punctuation: bool = False
    numbers: bool = False
    difficulty: Difficulty = Difficulty.EASY
    language: Language = Language.EN
    duration: StrictInt | str = 30
    word_by_word: bool = False


class TypingProgressRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: UUID
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


class GetTypingTestRequest(BaseModel):
    test_id: UUID
    device_id: UUID | None = None
    word_by_word: bool = False


class UpdateTypingTestRequest(TypingProgressRequest):
    test_id: UUID


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
    idle_timeout_seconds: float
    metrics: TypingMetricsResponse
    result: TypingResultResponse | None
    view: 'TypingViewResponse'

class TypingInputRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: UUID
    sequence: int = Field(ge=0, strict=True)
    key: str = Field(max_length=64)
    word_by_word: bool = False


class UpdateTypingInputRequest(TypingInputRequest):
    test_id: UUID


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
    clock: str
    elapsed_percent: float
    active: bool
    can_type: bool
    can_configure: bool
    urgent: bool
    custom_duration: bool
    durations: list[int]
    result_chart: list[ChartSampleResponse]
