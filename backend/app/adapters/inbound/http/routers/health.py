from fastapi import APIRouter

from app.adapters.inbound.http.schemas.api import ApiResponse
from app.adapters.inbound.http.schemas.health import HealthResponse

router = APIRouter(prefix="/health", tags=["system"])


@router.get("", response_model=ApiResponse[HealthResponse])
def health_check():
    """Expose a lightweight liveness check for local development."""
    return {"data": HealthResponse(status="ok")}
