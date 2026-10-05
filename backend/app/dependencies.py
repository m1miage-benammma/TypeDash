from uuid import UUID

from app.api.requests.device import DeviceRequest, DeviceUsernameRequest, UsernameRequest
from app.api.requests.typing import GetTypingTestRequest


def get_device_request(device_id: UUID) -> DeviceRequest:
    return DeviceRequest(device_id=device_id)


def get_username_request(device_id: UUID, body: UsernameRequest) -> DeviceUsernameRequest:
    return DeviceUsernameRequest(device_id=device_id, username=body.username)


def get_test_request(test_id: UUID, device_id: UUID | None = None, word_by_word: bool = False,
                     compact: bool = False) -> GetTypingTestRequest:
    return GetTypingTestRequest(test_id=test_id, device_id=device_id, word_by_word=word_by_word,
                                compact=compact)
