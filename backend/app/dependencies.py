from uuid import UUID

from app.api.schemas.device import DeviceRequest, DeviceUsernameRequest, UsernameRequest
from app.api.schemas.typing import (
    GetTypingTestRequest, TypingProgressRequest, UpdateTypingTestRequest,
    TypingInputRequest, UpdateTypingInputRequest,
    TypingBatchRequest, UpdateTypingBatchRequest,
)


def get_device_request(device_id: UUID) -> DeviceRequest:
    return DeviceRequest(device_id=device_id)


def get_username_request(device_id: UUID, body: UsernameRequest) -> DeviceUsernameRequest:
    return DeviceUsernameRequest(device_id=device_id, username=body.username)


def get_test_request(test_id: UUID, device_id: UUID | None = None, word_by_word: bool = False) -> GetTypingTestRequest:
    return GetTypingTestRequest(test_id=test_id, device_id=device_id, word_by_word=word_by_word)


def get_progress_request(test_id: UUID, body: TypingProgressRequest) -> UpdateTypingTestRequest:
    return UpdateTypingTestRequest(test_id=test_id, **body.model_dump())

def get_input_request(test_id: UUID, body: TypingInputRequest) -> UpdateTypingInputRequest:
    return UpdateTypingInputRequest(test_id=test_id, **body.model_dump())


def get_batch_request(test_id: UUID, body: TypingBatchRequest) -> UpdateTypingBatchRequest:
    return UpdateTypingBatchRequest(test_id=test_id, **body.model_dump())
