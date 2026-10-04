from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.adapters.inbound.http.schemas.api import ApiResponse
from app.adapters.inbound.http.schemas.identity import (
    DeviceProfileResponse,
    UsernameRequest,
)
from app.application.dto.identity import RegisterDeviceCommand, UpdateUsernameCommand
from app.application.use_cases.device_accounts import DeviceAccounts
from app.dependencies import get_device_accounts


router = APIRouter(prefix="/api/devices", tags=["devices"])
Service = Annotated[DeviceAccounts, Depends(get_device_accounts)]


@router.get("/{device_id}", response_model=ApiResponse[DeviceProfileResponse])
def get_profile(device_id: UUID, service: Service):
    return {"data": service.profile(str(device_id))}


@router.put("/{device_id}/registration", response_model=ApiResponse[DeviceProfileResponse])
def register(device_id: UUID, body: UsernameRequest, service: Service):
    return {
        "data": service.register(RegisterDeviceCommand(str(device_id), body.username))
    }


@router.patch("/{device_id}/username", response_model=ApiResponse[DeviceProfileResponse])
def update_username(device_id: UUID, body: UsernameRequest, service: Service):
    return {
        "data": service.update_username(
            UpdateUsernameCommand(str(device_id), body.username)
        )
    }


@router.delete("/{device_id}/stats", response_model=ApiResponse[DeviceProfileResponse])
def clear_stats(device_id: UUID, service: Service):
    return {"data": service.clear_stats(str(device_id))}
