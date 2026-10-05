from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.schemas.api import ApiResponse
from app.api.schemas.device import DeviceRequest, DeviceUsernameRequest, DeviceProfileResponse
from app.dependencies import get_device_request, get_username_request
from app.services.device_service import DeviceService


def create_router(service: DeviceService) -> APIRouter:
    router = APIRouter(prefix="/api/devices", tags=["devices"])
    DeviceInput = Annotated[DeviceRequest, Depends(get_device_request)]
    UsernameInput = Annotated[DeviceUsernameRequest, Depends(get_username_request)]

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
