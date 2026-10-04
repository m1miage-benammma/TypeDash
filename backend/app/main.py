from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.adapters.inbound.http.routers.devices import router as devices_router
from app.adapters.inbound.http.routers.health import router as health_router
from app.adapters.inbound.http.routers.typing import router as typing_router
from app.adapters.inbound.http.schemas.api import ApiErrorDetail, ApiErrorResponse
from app.adapters.outbound.services.identity_repository import (
    MemoryIdentityRepository,
    PostgresIdentityRepository,
)
from app.adapters.outbound.services.prompts import WordBankSource
from app.adapters.outbound.services.test_repository import MemoryTestRepository, PostgresTestRepository
from app.application.use_cases.device_accounts import DeviceAccounts
from app.application.use_cases.typing_tests import TypingTests
from app.core.config import settings
from app.domain.entities.identity import IdentityError
from app.domain.entities.typing_test import TestError


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.storage == "memory":
        test_repository = MemoryTestRepository()
        identity_repository = MemoryIdentityRepository()
        logging.warning("TypeDash uses volatile memory storage (explicit local development mode).")
    else:
        test_repository = PostgresTestRepository(settings)
        identity_repository = PostgresIdentityRepository(settings)
        test_repository.initialize()
        identity_repository.initialize()
    app.state.device_accounts = DeviceAccounts(identity_repository)
    app.state.typing_tests = TypingTests(
        test_repository,
        WordBankSource(),
        identity_repository,
    )
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)
app.include_router(health_router, prefix="/api")
app.include_router(typing_router)
app.include_router(devices_router)


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


@app.exception_handler(IdentityError)
async def identity_error(_request: Request, exc: IdentityError):
    status = 404 if exc.code == "device_not_found" else 422 if exc.code == "invalid_username" else 409
    messages = {
        "device_not_found": "Device profile not found.",
        "invalid_username": "Username must contain 3 to 24 letters, numbers, underscores or hyphens.",
        "username_taken": "This username is already in use.",
        "username_change_limit_reached": "A username can only be changed three times.",
        "already_registered": "This device is already registered.",
        "not_registered": "This device does not have a registered user.",
    }
    return JSONResponse(
        status_code=status,
        content=ApiErrorResponse(
            error=ApiErrorDetail(
                code=exc.code,
                message=messages.get(exc.code, "Device profile conflict."),
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
