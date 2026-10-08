from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from app.api.responses.api import ApiResponse
from app.api.requests.typing import (
    CreateTypingTestRequest, GetTypingTestRequest, TypingBatchRequest, TypingDurationRequest,
)
from app.api.responses.typing import TypingTestResponse
from app.dependencies import get_test_request
from app.services.typing_service import TypingService


def create_router(service: TypingService) -> APIRouter:
    router = APIRouter(prefix="/api/tests", tags=["typing tests"])
    TestInput = Annotated[GetTypingTestRequest, Depends(get_test_request)]

    @router.post("", response_model=ApiResponse[TypingTestResponse], status_code=201)
    def prepare(request: CreateTypingTestRequest) -> ApiResponse[TypingTestResponse]:
        return service.prepare(request)

    @router.post("/{test_id}/inputs")
    def inputs(test_id: UUID, batch: TypingBatchRequest) -> dict:
        return service.apply_inputs(str(test_id), batch)

    @router.put("/{test_id}/duration")
    def duration(test_id: UUID, request: TypingDurationRequest) -> dict:
        return service.change_duration(str(test_id), request)

    @router.get("/{test_id}", response_model=ApiResponse[TypingTestResponse])
    def get_test(request: TestInput) -> ApiResponse[TypingTestResponse]:
        return service.get(request)

    return router
