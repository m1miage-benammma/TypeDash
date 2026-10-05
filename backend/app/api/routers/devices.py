from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.responses.api import ApiResponse
from app.api.requests.device import DeviceRequest, DeviceUsernameRequest
from app.api.responses.device import DeviceProfileResponse
from app.dependencies import get_device_request, get_username_request
from app.services.device_service import DeviceService
from app.services.session_service import SessionService
from app.api.requests.session import SessionRequest
from app.api.responses.session import SessionResponse


def create_router(service: DeviceService) -> APIRouter:
    router = APIRouter(prefix="/api/devices", tags=["devices"])
    sessions = SessionService(service.repository)
    DeviceInput = Annotated[DeviceRequest, Depends(get_device_request)]
    UsernameInput = Annotated[DeviceUsernameRequest, Depends(get_username_request)]

    @router.get("/{device_id}/stats/{stat_id}", response_model=ApiResponse[SessionResponse])
    def get_session(device_id: UUID, stat_id: UUID) -> ApiResponse[SessionResponse]:
        return sessions.get(SessionRequest(device_id=device_id, stat_id=stat_id))

    @router.get("/{device_id}", response_model=ApiResponse[DeviceProfileResponse])
    def get_profile(request: DeviceInput) -> ApiResponse[DeviceProfileResponse]:
        return service.profile(request)

    @router.put("/{device_id}/registration",
                response_model=ApiResponse[DeviceProfileResponse])
    def register(request: UsernameInput) -> ApiResponse[DeviceProfileResponse]:
        return service.register(request)

    @router.patch("/{device_id}/username",
                  response_model=ApiResponse[DeviceProfileResponse])
    def update_username(request: UsernameInput) -> ApiResponse[DeviceProfileResponse]:
        return service.update_username(request)

    @router.delete("/{device_id}/stats",
                   response_model=ApiResponse[DeviceProfileResponse])
    def clear_stats(request: DeviceInput) -> ApiResponse[DeviceProfileResponse]:
        return service.clear_stats(request)

    return router
