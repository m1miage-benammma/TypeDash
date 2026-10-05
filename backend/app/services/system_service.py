from app.api.schemas.api import ApiResponse
from app.api.schemas.health import HealthResponse, RootResponse


class SystemService:
    @staticmethod
    def health() -> ApiResponse[HealthResponse]:
        return ApiResponse[HealthResponse](data=HealthResponse(status="ok"))

    @staticmethod
    def root() -> ApiResponse[RootResponse]:
        return ApiResponse[RootResponse](
            data=RootResponse(name="typedash-api", status="ok"),
        )
