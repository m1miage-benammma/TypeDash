from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictInt

from app.models.enums import Difficulty, Language


class CreateTypingTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    punctuation: bool = False
    numbers: bool = False
    difficulty: Difficulty = Difficulty.EASY
    language: Language = Language.EN
    duration: StrictInt | str = 30
    word_by_word: bool = False
    compact: bool = False


class GetTypingTestRequest(BaseModel):
    test_id: UUID
    device_id: UUID | None = None
    word_by_word: bool = False
    compact: bool = False


class TypingKeyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sequence: int = Field(ge=0, strict=True)
    key: str = Field(max_length=64)
    word_by_word: bool = False


class TypingBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: UUID
    inputs: list[TypingKeyRequest] = Field(min_length=1, max_length=256)
