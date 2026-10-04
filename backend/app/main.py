from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.adapters.inbound.http.routers.health import router as health_router
from app.adapters.inbound.http.routers.typing import router as typing_router
from app.adapters.inbound.http.schemas.api import ApiErrorDetail, ApiErrorResponse
from app.adapters.outbound.services.prompts import WordBankSource
from app.adapters.outbound.services.test_repository import MemoryTestRepository, PostgresTestRepository
from app.application.use_cases.typing_tests import TypingTests
from app.core.config import settings
from app.domain.entities.typing_test import TestError

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.storage == "memory":
        repository = MemoryTestRepository()
        logging.warning("TypeDash uses volatile memory storage (explicit local development mode).")
    else:
        repository = PostgresTestRepository(settings)
        repository.initialize()
    app.state.typing_tests = TypingTests(repository, WordBankSource())
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    debug=settings.debug,
    lifespan=lifespan,
)
app.include_router(health_router, prefix="/api")
app.include_router(typing_router)


@app.exception_handler(TestError)
async def test_error(_request: Request, exc: TestError):
    status = 404 if exc.code == "not_found" else 410 if exc.code == "expired" else 409
    messages = {
        "not_found": "Typing session not found.",
        "expired": "Typing session expired.",
        "still_running": "The typing session still has active time remaining.",
        "text_too_long": "Typed text exceeds the generated prompt.",
        "capacity_reached": "The temporary session capacity has been reached.",
    }
    return JSONResponse(
        status_code=status,
        content=ApiErrorResponse(
            error=ApiErrorDetail(
                code=exc.code,
                message=messages.get(exc.code, "Typing session conflict."),
            )
        ).model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, _exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=ApiErrorResponse(
            error=ApiErrorDetail(
                code="validation_error",
                message="The request contains invalid or unsupported values.",
            )
        ).model_dump(),
    )


@app.get("/", tags=["system"])
def read_root():
    """Return a minimal API status response."""
    return {"data": {"name": "typedash-api", "status": "ok"}}
