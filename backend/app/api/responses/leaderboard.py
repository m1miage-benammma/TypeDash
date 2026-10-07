from typing import Literal

from pydantic import BaseModel


class LeaderboardEntryResponse(BaseModel):
    rank: int
    username: str
    wpm: float
    difficulty: Literal["easy", "medium", "hard", "mixed"]
    is_current: bool


class LeaderboardsResponse(BaseModel):
    average: list[LeaderboardEntryResponse]
    top_speed: list[LeaderboardEntryResponse]
