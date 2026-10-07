from app.ports.leaderboard_repository import LeaderboardRepository
from app.api.responses.api import ApiResponse
from app.api.responses.leaderboard import LeaderboardsResponse, LeaderboardEntryResponse


class LeaderboardService:
    def __init__(self, repository: LeaderboardRepository):
        self.repository = repository

    def get(self) -> ApiResponse[LeaderboardsResponse]:
        boards = self.repository.snapshot()
        def ranked(rows):
            return [LeaderboardEntryResponse(
                rank=row.rank,
                username=row.username,
                wpm=row.wpm,
                difficulty=row.difficulty,
                is_current=row.is_current,
            ) for row in rows]
        return ApiResponse(data=LeaderboardsResponse(
            average=ranked(boards.average), top_speed=ranked(boards.top_speed),
        ))
