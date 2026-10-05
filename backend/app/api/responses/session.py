from pydantic import BaseModel

from app.models.enums import Difficulty, Language
from app.api.responses.typing import ChartSampleResponse, TypingResultResponse


class SessionViewResponse(BaseModel):
    result_chart: list[ChartSampleResponse]


class SessionResponse(BaseModel):
    id: str
    difficulty: Difficulty
    language: Language
    duration: int
    punctuation: bool
    numbers: bool
    result: TypingResultResponse
    view: SessionViewResponse
