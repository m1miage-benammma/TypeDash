from typing import Protocol
from app.models.leaderboard import Leaderboards


class LeaderboardRepository(Protocol):
    def snapshot(self) -> Leaderboards: ...
