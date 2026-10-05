from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.schemas.api import ApiErrorDetail, ApiErrorResponse
from app.models.errors import IdentityError, TypingTestError


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(TypingTestError, typing_test_error)
    app.add_exception_handler(IdentityError, identity_error)
    app.add_exception_handler(RequestValidationError, validation_error)


async def typing_test_error(_request: Request, exc: TypingTestError):
    status = {
        "not_found": 404,
        "expired": 410,
        "duration_max": 422,
        "duration_invalid": 422,
        "calculator_invalid": 422,
    }.get(exc.code, 409)
    messages = {
        "not_found": "Typing session not found.",
        "expired": "Typing session expired.",
        "still_running": "The typing session still has active time remaining.",
        "text_too_long": "Typed text exceeds the generated prompt.",
        "capacity_reached": "The temporary session capacity has been reached.",
        "duration_max": "The maximum duration is 300 seconds.",
        "duration_invalid": "Duration must be a positive integer.",
        "calculator_invalid": "The calculator contains invalid values.",
        "input_out_of_order": "Input events must be sent in sequence.",
    }
    return _error_response(
        status,
        exc.code,
        messages.get(exc.code, "Typing session conflict."),
    )


async def identity_error(_request: Request, exc: IdentityError):
    status = {
        "device_not_found": 404,
        "invalid_username": 422,
    }.get(exc.code, 409)
    messages = {
        "device_not_found": "Device profile not found.",
        "invalid_username": (
            "Username must contain 3 to 24 letters, numbers, "
            "underscores or hyphens."
        ),
        "username_taken": "This username is already in use.",
        "username_change_limit_reached": (
            "A username can only be changed three times."
        ),
        "already_registered": "This device is already registered.",
        "not_registered": "This device does not have a registered user.",
    }
    return _error_response(
        status,
        exc.code,
        messages.get(exc.code, "Device profile conflict."),
    )


async def validation_error(
    _request: Request,
    _exc: RequestValidationError,
):
    return _error_response(
        422,
        "validation_error",
        "The request contains invalid or unsupported values.",
    )


def _error_response(status: int, code: str, message: str) -> JSONResponse:
    content = ApiErrorResponse(
        error=ApiErrorDetail(code=code, message=message)
    ).model_dump()
    return JSONResponse(status_code=status, content=content)
