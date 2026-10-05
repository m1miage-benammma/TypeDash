from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket

from app.api.responses.api import ApiResponse
from app.api.requests.typing import CreateTypingTestRequest, GetTypingTestRequest
from app.api.responses.typing import TypingTestResponse
from app.dependencies import get_test_request
from app.services.typing_service import TypingService
from app.services.typing_stream_service import TypingStreamService


def create_router(service: TypingService) -> APIRouter:
    router = APIRouter(prefix="/api/tests", tags=["typing tests"])
    stream = TypingStreamService(service)
    TestInput = Annotated[GetTypingTestRequest, Depends(get_test_request)]

    @router.post("", response_model=ApiResponse[TypingTestResponse], status_code=201)
    def prepare(request: CreateTypingTestRequest) -> ApiResponse[TypingTestResponse]:
        return service.prepare(request)

    @router.websocket("/{test_id}/stream")
    async def realtime(socket: WebSocket, request: TestInput):
        await stream.connect(socket, request)

    @router.get("/{test_id}", response_model=ApiResponse[TypingTestResponse])
    def get_test(request: TestInput) -> ApiResponse[TypingTestResponse]:
        return service.get(request)

    return router
