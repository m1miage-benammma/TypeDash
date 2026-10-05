from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.schemas.api import ApiResponse
from app.api.schemas.typing import (
    CreateTypingTestRequest, GetTypingTestRequest,
    UpdateTypingTestRequest, UpdateTypingInputRequest, TypingTestResponse,
)
from app.dependencies import get_test_request, get_progress_request, get_input_request
from app.services.typing_service import TypingService


def create_router(service: TypingService) -> APIRouter:
    router = APIRouter(prefix="/api/tests", tags=["typing tests"])
    TestInput = Annotated[GetTypingTestRequest, Depends(get_test_request)]
    ProgressInput = Annotated[UpdateTypingTestRequest, Depends(get_progress_request)]

    @router.post("", response_model=ApiResponse[TypingTestResponse], status_code=201)
    def prepare(request: CreateTypingTestRequest) -> ApiResponse[TypingTestResponse]:
        return service.prepare(request)

    @router.get("/{test_id}", response_model=ApiResponse[TypingTestResponse])
    def get_test(request: TestInput) -> ApiResponse[TypingTestResponse]:
        return service.get(request)

    @router.put("/{test_id}/progress", response_model=ApiResponse[TypingTestResponse])
    def progress(request: ProgressInput) -> ApiResponse[TypingTestResponse]:
        return service.progress(request)

    @router.post("/{test_id}/finish", response_model=ApiResponse[TypingTestResponse])
    def finish(request: ProgressInput) -> ApiResponse[TypingTestResponse]:
        return service.finish(request)

    @router.put("/{test_id}/input", response_model=ApiResponse[TypingTestResponse])
    def input_key(request: Annotated[UpdateTypingInputRequest, Depends(get_input_request)]) -> ApiResponse[TypingTestResponse]:
        return service.input(request)

    return router
