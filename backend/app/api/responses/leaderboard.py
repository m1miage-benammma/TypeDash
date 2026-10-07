from pydantic import BaseModel


class LeaderboardEntryResponse(BaseModel):
    rank: int
    username: str
    wpm: float


class LeaderboardsResponse(BaseModel):
    average: list[LeaderboardEntryResponse]
    top_speed: list[LeaderboardEntryResponse]
