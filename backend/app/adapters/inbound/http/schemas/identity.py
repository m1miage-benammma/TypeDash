from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domain.entities.identity import USERNAME_PATTERN_TEXT
from app.domain.enums.typing import Difficulty, Language


class UsernameRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(
        min_length=3,
        max_length=24,
        pattern=USERNAME_PATTERN_TEXT,
    )


class DeviceSummaryResponse(BaseModel):
    sessions: int
    best_wpm: float
    average_wpm: float
    average_accuracy: float


class DeviceStatResponse(BaseModel):
    id: UUID
    test_id: UUID
    difficulty: Difficulty
    language: Language
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


class DeviceProfileResponse(BaseModel):
    device_id: UUID
    username: str | None
    registered: bool
    username_changes: int
    username_changes_remaining: int
    summary: DeviceSummaryResponse
    stats: list[DeviceStatResponse]
