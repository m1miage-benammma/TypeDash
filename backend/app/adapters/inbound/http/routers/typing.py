from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.adapters.inbound.http.schemas.api import ApiResponse
from app.adapters.inbound.http.schemas.typing import (
    CreateTypingTestRequest,
    TypingProgressRequest,
    TypingTestResponse,
)
from app.application.dto.typing import CreateTypingTestCommand, UpdateTypingTestCommand
from app.application.use_cases.typing_tests import TypingTests
from app.dependencies import get_typing_tests

router = APIRouter(prefix="/api/tests", tags=["typing tests"])
Service = Annotated[TypingTests, Depends(get_typing_tests)]


@router.post("", response_model=ApiResponse[TypingTestResponse], status_code=201)
def prepare(body: CreateTypingTestRequest, service: Service):
    command = CreateTypingTestCommand(
        difficulty=body.difficulty,
        language=body.language,
        duration=body.duration,
        punctuation=body.punctuation,
        numbers=body.numbers,
    )
    return {"data": service.prepare(command)}


@router.get("/{test_id}", response_model=ApiResponse[TypingTestResponse])
def get_test(test_id: UUID, service: Service):
    return {"data": service.get(str(test_id))}


@router.put("/{test_id}/progress", response_model=ApiResponse[TypingTestResponse])
def progress(test_id: UUID, body: TypingProgressRequest, service: Service):
    command = UpdateTypingTestCommand(str(test_id), body.typed, body.revision)
    return {"data": service.progress(command)}


@router.post("/{test_id}/finish", response_model=ApiResponse[TypingTestResponse])
def finish(test_id: UUID, body: TypingProgressRequest, service: Service):
    command = UpdateTypingTestCommand(str(test_id), body.typed, body.revision, finish=True)
    return {"data": service.progress(command)}
