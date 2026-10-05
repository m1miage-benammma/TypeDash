from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import Difficulty, Language


class UsernameRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str


class DeviceSummaryResponse(BaseModel):
    sessions: int
    best_wpm: float
    average_wpm: float
    average_accuracy: float


class DeviceRequest(BaseModel):
    device_id: UUID


class DeviceUsernameRequest(UsernameRequest):
    device_id: UUID


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
    history_chart: list['DeviceChartPointResponse']
    requires_registration: bool
    can_change_username: bool

class DeviceChartPointResponse(BaseModel):
    id: UUID
    wpm: float
    finished_at: str
    height_pixels: float
