from app.ports.leaderboard_repository import LeaderboardRepository
from app.api.responses.api import ApiResponse
from app.api.responses.leaderboard import LeaderboardsResponse, LeaderboardEntryResponse
from app.core.security_context import device_context
from app.ports.response_cache import ResponseCache


class LeaderboardService:
    def __init__(self, repository: LeaderboardRepository,
                 cache: ResponseCache | None = None):
        self.repository = repository
        self.cache = cache

    def get(self) -> ApiResponse[LeaderboardsResponse]:
        cache_key = "leaderboard:v1:" + (device_context.get() or "anonymous")
        cached = self.cache.get(cache_key) if self.cache else None
        if cached:
            try:
                return ApiResponse(data=LeaderboardsResponse.model_validate_json(cached))
            except ValueError:
                pass
        boards = self.repository.snapshot()
        def ranked(rows):
            return [LeaderboardEntryResponse(
                rank=row.rank,
                username=row.username,
                wpm=row.wpm,
                difficulty=row.difficulty,
                is_current=row.is_current,
            ) for row in rows]
        response = LeaderboardsResponse(
            average=ranked(boards.average), top_speed=ranked(boards.top_speed),
        )
        if self.cache:
            self.cache.set(cache_key, response.model_dump_json(), ttl=15)
        return ApiResponse(data=response)
