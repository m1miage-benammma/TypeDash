from app.api.responses.api import ApiResponse
from app.api.responses.health import HealthResponse


class SystemService:
    @staticmethod
    def health() -> ApiResponse[HealthResponse]:
        return ApiResponse[HealthResponse](data=HealthResponse(status="ok"))
