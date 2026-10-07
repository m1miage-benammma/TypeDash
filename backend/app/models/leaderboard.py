from dataclasses import dataclass


@dataclass(frozen=True)
class LeaderboardEntry:
    username: str
    wpm: float
    difficulty: str
    rank: int
    is_current: bool


@dataclass(frozen=True)
class Leaderboards:
    average: tuple[LeaderboardEntry, ...]
    top_speed: tuple[LeaderboardEntry, ...]
