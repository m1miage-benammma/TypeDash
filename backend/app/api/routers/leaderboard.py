from fastapi import APIRouter
from app.api.responses.api import ApiResponse
from app.api.responses.leaderboard import LeaderboardsResponse
from app.services.leaderboard_service import LeaderboardService


def create_router(service: LeaderboardService) -> APIRouter:
    router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

    @router.get("", response_model=ApiResponse[LeaderboardsResponse])
    def leaderboard():
        return service.get()

    return router
