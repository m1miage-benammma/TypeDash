from app.ports.leaderboard_repository import LeaderboardRepository
from app.api.responses.api import ApiResponse
from app.api.responses.leaderboard import LeaderboardsResponse, LeaderboardEntryResponse


class LeaderboardService:
    def __init__(self, repository: LeaderboardRepository):
        self.repository = repository

    def get(self) -> ApiResponse[LeaderboardsResponse]:
        boards = self.repository.snapshot()
        def ranked(rows):
            return [LeaderboardEntryResponse(rank=rank, username=row.username, wpm=row.wpm)
                    for rank, row in enumerate(rows, 1)]
        return ApiResponse(data=LeaderboardsResponse(
            average=ranked(boards.average), top_speed=ranked(boards.top_speed),
        ))
