from fastapi import APIRouter

from app.api.responses.api import ApiResponse
from app.api.responses.health import HealthResponse
from app.services.system_service import SystemService

router = APIRouter(prefix="/health", tags=["system"])


@router.get("", response_model=ApiResponse[HealthResponse])
def health_check() -> ApiResponse[HealthResponse]:
    return SystemService.health()
