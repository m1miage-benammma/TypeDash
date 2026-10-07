from typing import Annotated
import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, Request, HTTPException, WebSocketDisconnect
from app.api.responses.auth import StreamTicketResponse
from app.core.security_context import device_context
from app.models.errors import TypingTestError

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

    @router.post("/{test_id}/ticket", response_model=ApiResponse[StreamTicketResponse])
    def ticket(test_id: UUID, http: Request):
        service.get(GetTypingTestRequest(test_id=test_id, device_id=UUID(device_context.get()), compact=True))
        return ApiResponse(data=StreamTicketResponse(ticket=http.app.state.security.sign(
            device_context.get(), "stream", 30, str(test_id))))

    @router.websocket("/{test_id}/stream")
    async def realtime(socket: WebSocket, test_id: UUID, word_by_word: bool = False, compact: bool = False):
        security = socket.app.state.security
        if socket.headers.get("origin") not in security.origins:
            await socket.close(code=1008)
            return
        peer = socket.client.host if socket.client else "unknown"
        limits = socket.app.state.rate_limits
        for key, maximum in [("ws-global", 240), ("ws-ip:" + security.client_key(peer), 60)]:
            if not await asyncio.to_thread(limits.allow, key, maximum):
                await socket.close(code=1013)
                return
        await socket.accept()
        context = None
        try:
            raw = await asyncio.wait_for(socket.receive_text(), timeout=5)
            if len(raw) > 2048:
                raise ValueError()
            message = json.loads(raw)
            device = security.verify(message.get("ticket"), "stream", str(test_id))
            context = device_context.set(device)
            if not await asyncio.to_thread(limits.allow, "ws-device:" + device, 30):
                await socket.close(code=1013)
                return
            await stream.connect(socket, GetTypingTestRequest(test_id=test_id, device_id=UUID(device),
                                 word_by_word=word_by_word, compact=compact))
        except (HTTPException, ValueError, AttributeError, asyncio.TimeoutError, TypingTestError):
            await socket.close(code=1008, reason="Stream authentication failed.")
        except WebSocketDisconnect:
            pass
        finally:
            if context is not None:
                device_context.reset(context)

    @router.get("/{test_id}", response_model=ApiResponse[TypingTestResponse])
    def get_test(request: TestInput) -> ApiResponse[TypingTestResponse]:
        return service.get(request)

    return router
