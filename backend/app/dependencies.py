from uuid import UUID
from fastapi import HTTPException
from app.core.security_context import device_context

from app.api.requests.device import DeviceRequest, DeviceUsernameRequest, UsernameRequest
from app.api.requests.typing import GetTypingTestRequest


def get_device_request(device_id: UUID) -> DeviceRequest:
    require_device(device_id)
    return DeviceRequest(device_id=device_id)


def get_username_request(device_id: UUID, body: UsernameRequest) -> DeviceUsernameRequest:
    require_device(device_id)
    return DeviceUsernameRequest(device_id=device_id, username=body.username)


def get_test_request(test_id: UUID, device_id: UUID | None = None, word_by_word: bool = False,
                     compact: bool = False) -> GetTypingTestRequest:
    authenticated = device_context.get()
    if not authenticated:
        raise HTTPException(401, "Session authentication required.")
    if device_id is not None:
        require_device(device_id)
    device_id = UUID(authenticated)
    return GetTypingTestRequest(test_id=test_id, device_id=device_id, word_by_word=word_by_word,
                                compact=compact)


def require_device(device_id: UUID) -> None:
    if str(device_id) != device_context.get():
        raise HTTPException(403, "Access to this device is forbidden.")
